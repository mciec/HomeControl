using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using MqttManager;

namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Hosted service that owns the shared <see cref="MqttClient"/> connection for the Devices
/// feature: connects on startup, subscribes to the MotionTopic of every configured
/// LedStripeWithSensors device, deserializes incoming animation lifecycle events, updates
/// the in-memory <see cref="DeviceRegistry"/>, and broadcasts the change over SignalR.
/// Reconnect/backoff resilience and topic re-subscription on reconnect are handled
/// internally by <see cref="MqttClient"/> (from the shared MqttManager library) — this
/// service only wires it up and reacts to its events.
///
/// Also implements <see cref="IDeviceCommandPublisher"/> so the controller can publish
/// override commands through the same MqttClient instance.
/// </summary>
public sealed class DeviceMqttListenerService : BackgroundService, IDeviceCommandPublisher
{
    private static readonly JsonSerializerOptions PayloadSerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>Wire shape of the JSON payload a device publishes on its motion topic whenever
    /// an animation starts or stops. Mirrors LedStripeWithSensors.MqttManager.AnimationEventMessage
    /// on the device side. Event/Direction/Source are received as plain strings and parsed with
    /// Enum.TryParse rather than JsonStringEnumConverter, so an unrecognized value falls through
    /// to the "ignore unrecognized payload" path below instead of throwing.</summary>
    private sealed record AnimationEventPayload(
        string? Event,
        string? Direction,
        string? Source,
        string? Animation,
        DateTime? StartedAtUtc,
        int? DurationMs);

    private readonly MqttClient _mqttClient;
    private readonly DeviceRegistry _registry;
    private readonly IHubContext<DeviceHub> _hubContext;
    private readonly ILogger<DeviceMqttListenerService> _logger;

    public DeviceMqttListenerService(
        MqttClient mqttClient,
        DeviceRegistry registry,
        IHubContext<DeviceHub> hubContext,
        ILogger<DeviceMqttListenerService> logger)
    {
        _mqttClient = mqttClient;
        _registry = registry;
        _hubContext = hubContext;
        _logger = logger;

        _mqttClient.MessageReceived += OnMqttMessageReceived;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var motionTopics = _registry.GetAll()
            .Where(d => d.Type == DeviceType.LedStripeWithSensors && !string.IsNullOrEmpty(d.MotionTopic))
            .Select(d => d.MotionTopic!)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        _logger.LogInformation("Starting MQTT client, subscribing to {count} motion topic(s).", motionTopics.Count);
        _mqttClient.Connect(motionTopics, stoppingToken);

        try
        {
            // MqttClient manages its own connect/reconnect loop internally; this service
            // just needs to stay alive for the lifetime of the host to keep receiving events.
            await Task.Delay(Timeout.Infinite, stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            // Expected during shutdown.
        }
    }

    private void OnMqttMessageReceived(object? sender, MqttMessageReceivedEventArgs args)
    {
        var receivedAt = DateTimeOffset.UtcNow;
        var device = _registry.GetByMotionTopic(args.Topic);
        if (device is null)
            return;

        AnimationEventPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<AnimationEventPayload>(args.Payload, PayloadSerializerOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogDebug(ex, "Ignoring unparseable motion payload '{Payload}' on topic '{Topic}'.", args.Payload, args.Topic);
            return;
        }

        if (payload is null
            || !Enum.TryParse<AnimationEventType>(payload.Event, ignoreCase: true, out var eventType)
            || !Enum.TryParse<OverrideDirection>(payload.Direction, ignoreCase: true, out var direction)
            || !Enum.TryParse<AnimationSource>(payload.Source, ignoreCase: true, out var source))
        {
            _logger.LogDebug("Ignoring unrecognized motion payload '{Payload}' on topic '{Topic}'.", args.Payload, args.Topic);
            return;
        }

        // Timing diagnostics: how long after the device's own timestamp did this message reach us?
        // Informational only - a large +/- value means the device's and this machine's clocks
        // disagree, which the stored animation times no longer depend on (see below).
        _logger.LogInformation(
            "MQTT {Event} {Direction} {Source} received on '{Topic}' at {ReceivedAt:HH:mm:ss.fff}; device startedAtUtc={StartedAt:HH:mm:ss.fff}, lag={LagMs:F0} ms",
            eventType, direction, source, args.Topic, receivedAt, payload.StartedAtUtc,
            payload.StartedAtUtc is { } sa ? (receivedAt - new DateTimeOffset(DateTime.SpecifyKind(sa, DateTimeKind.Utc))).TotalMilliseconds : double.NaN);

        DateTimeOffset? startedAtUtc = null;
        DateTimeOffset? endsAtUtc = null;
        if (eventType == AnimationEventType.Started)
        {
            if (payload.StartedAtUtc is null || payload.DurationMs is null)
            {
                _logger.LogDebug("Ignoring Started motion payload missing startedAtUtc/durationMs on topic '{Topic}'.", args.Topic);
                return;
            }

            // Anchor the animation to the SERVER's clock: it starts when this message arrived and
            // ends DurationMs later. The device's own startedAtUtc is deliberately not used for the
            // stored/broadcast times - clients count down against server time (serverTimeUtc), and a
            // device or server clock that is off by seconds would otherwise shift the progress bar by
            // exactly that much. The error introduced (MQTT transit, ~100 ms) is negligible.
            startedAtUtc = receivedAt;
            endsAtUtc = receivedAt.AddMilliseconds(payload.DurationMs.Value);
        }

        var newState = _registry.ApplyAnimationEvent(
            device.Id,
            eventType,
            direction,
            source,
            payload.Animation,
            startedAtUtc,
            endsAtUtc,
            DateTimeOffset.UtcNow);
        if (newState is null)
            return;

        var message = new DeviceStateChangedMessage(
            device.Id,
            device.Type,
            LedStripeWithSensorsStateDto.FromState(newState));

        _ = BroadcastAsync(message, receivedAt);
    }

    private async Task BroadcastAsync(DeviceStateChangedMessage message, DateTimeOffset receivedAt)
    {
        try
        {
            await _hubContext.Clients.All.SendAsync("DeviceStateChanged", message).ConfigureAwait(false);
            _logger.LogInformation("SignalR DeviceStateChanged for '{DeviceId}' sent {ElapsedMs:F0} ms after MQTT receipt.",
                message.DeviceId, (DateTimeOffset.UtcNow - receivedAt).TotalMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast DeviceStateChanged for '{DeviceId}'.", message.DeviceId);
        }
    }

    public Task<bool> TryPublishOverrideAsync(string deviceId, OverrideDirection direction, CancellationToken ct)
    {
        var device = _registry.GetConfig(deviceId);
        if (device is null || device.Type != DeviceType.LedStripeWithSensors || string.IsNullOrEmpty(device.OverrideTopic))
        {
            return Task.FromResult(false);
        }

        if (!_mqttClient.IsConnected)
        {
            return Task.FromResult(false);
        }

        _mqttClient.Publish(device.OverrideTopic, direction.ToString().ToUpperInvariant());
        return Task.FromResult(true);
    }
}
