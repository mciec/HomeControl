using Microsoft.AspNetCore.SignalR;
using MqttManager;

namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Hosted service that owns the shared <see cref="MqttClient"/> connection for the Devices
/// feature: connects on startup, subscribes to the MotionTopic of every configured
/// LedStripeWithSensors device, normalizes incoming motion/echo payloads into an
/// <see cref="OverrideDirection"/>, updates the in-memory <see cref="DeviceRegistry"/>,
/// and broadcasts the change over SignalR. Reconnect/backoff resilience and topic
/// re-subscription on reconnect are handled internally by <see cref="MqttClient"/>
/// (from the shared MqttManager library) — this service only wires it up and reacts
/// to its events.
///
/// Also implements <see cref="IDeviceCommandPublisher"/> so the controller can publish
/// override commands through the same MqttClient instance.
/// </summary>
public sealed class DeviceMqttListenerService : BackgroundService, IDeviceCommandPublisher
{
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
        var device = _registry.GetByMotionTopic(args.Topic);
        if (device is null)
            return;

        var direction = NormalizeDirection(args.Payload);
        if (direction is null)
        {
            _logger.LogDebug("Ignoring unrecognized motion payload '{Payload}' on topic '{Topic}'.", args.Payload, args.Topic);
            return;
        }

        var newState = _registry.UpdateLedStripeOverrideReceived(device.Id, direction.Value, DateTimeOffset.UtcNow);
        if (newState is null)
            return;

        var message = new DeviceStateChangedMessage(
            device.Id,
            device.Type,
            new LedStripeWithSensorsStateDto(newState.LastOverrideLeftReceivedUtc, newState.LastOverrideRightReceivedUtc));

        _ = _hubContext.Clients.All.SendAsync("DeviceStateChanged", message);
    }

    /// <summary>
    /// Normalizes a raw entrance/motion payload: trim, uppercase, then resolve to Left/Right
    /// only if it unambiguously contains one direction keyword and not the other. This
    /// handles both clean "LEFT"/"RIGHT" payloads and the legacy noise echo strings
    /// ("left override detected" / "right override detected") without matching them exactly,
    /// and keeps working if the device firmware is later cleaned up.
    /// </summary>
    private static OverrideDirection? NormalizeDirection(string? payload)
    {
        var normalized = payload?.Trim().ToUpperInvariant() ?? "";
        var hasLeft = normalized.Contains("LEFT", StringComparison.Ordinal);
        var hasRight = normalized.Contains("RIGHT", StringComparison.Ordinal);

        if (hasLeft && !hasRight)
            return OverrideDirection.Left;
        if (hasRight && !hasLeft)
            return OverrideDirection.Right;

        return null;
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
