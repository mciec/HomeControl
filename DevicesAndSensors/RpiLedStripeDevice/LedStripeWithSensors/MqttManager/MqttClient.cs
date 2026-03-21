using System.Security;
using HiveMQtt.Client;
using HiveMQtt.Client.Exceptions;
using HiveMQtt.Client.Options;
using Iot.Device.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LedStripeWithSensors.MqttManager;

internal sealed class MqttClient : IAsyncDisposable
{
    private readonly SemaphoreSlim _allowReconnect;

    private const string MessageLeft = "LEFT";
    private const string MessageRight = "RIGHT";

    private readonly MqttClientConfig _config;
    private readonly ChannelManagerWithRecovery _channelManagerWithRecovery;
    private readonly ILogger<MqttClient> _logger;
    private HiveMQClient _client = null!;

    public MqttClient(IOptions<MqttClientConfig> config, ChannelManagerWithRecovery channelManagerWithRecovery, ILogger<MqttClient> logger)
    {
        _config = config.Value;
        _channelManagerWithRecovery = channelManagerWithRecovery;
        _logger = logger;
        _allowReconnect = new SemaphoreSlim(1);
    }

    public MqttClient Connect(Action onOverrideLeft, Action onOverrideRight, CancellationToken ct)
    {
        var options = new HiveMQClientOptions
        {
            ClientId = _config.ClientId,
            Host = _config.Host,
            Port = _config.Port,
            UseTLS = _config.UseTLS,
            UserName = _config.User,
            Password = ToSecureString(_config.Password)
        };

        _channelManagerWithRecovery.StartConsumer(
            recoveryAsyncFunc: async (CancellationToken ct) => await ReconnectAsync().ConfigureAwait(false),
            maxAttempts: 0,
            ct);

        _client = new HiveMQClient(options);

        _client.OnMessageReceived += (sender, args) =>
        {
            string payload = args.PublishMessage.PayloadAsString.ToUpper();
            switch (payload)
            {
                //TODO: clear
                case MessageLeft: onOverrideLeft(); Send("left override detected"); break;
                case MessageRight: onOverrideRight(); Send("right override detected"); break;
                default: break;
            }
        };

        _client.AfterDisconnect += async (sender, args) =>
        {
            _logger.LogError("MQTT client disconnected.");
            await ReconnectWithRetryAsync(0, ct).ConfigureAwait(false);
        };

        _ = ReconnectWithRetryAsync(0, ct);

        return this;
    }

    public void Send(string msg)
    {
        if (_channelManagerWithRecovery is null)
            throw new Exception("Channel manager not created");

        _channelManagerWithRecovery.Send(new ExpiratingAsyncDelegate()
        {
            Delegate = async (CancellationToken ct) =>
            {
                _logger.LogInformation("Sending message: {message} to topic: {topic}", msg, _config.MotionDetectedTopic);
                var result = await _client.PublishAsync(_config.MotionDetectedTopic, msg).ConfigureAwait(false);
                return true;
            },
            ExpirationDate = DateTime.UtcNow.AddSeconds(10)
        });
    }

    private async ValueTask<bool> ReconnectAsync()
    {
        try
        {
            if (!await _allowReconnect.WaitAsync(1000).ConfigureAwait(false))
            {
                _logger.LogInformation("Semaphore is taken.");
                return false;
            }

            _logger.LogInformation("Inside semaphore");

            if (_client.IsConnected())
            {
                _logger.LogInformation("Already connected");
                return true;
            }

            _logger.LogInformation("Trying to connect...");
            var connectResult = await _client.ConnectAsync().ConfigureAwait(false);
            if (connectResult.ReasonCode == HiveMQtt.MQTT5.ReasonCodes.ConnAckReasonCode.Success)
            {
                await Task.Delay(1000).ConfigureAwait(false);

                if (_client.Subscriptions.Any())
                {
                    _logger.LogInformation("Connected. Unsubscribing...");
                    foreach (var sub in _client.Subscriptions)
                    {
                        await _client.UnsubscribeAsync(sub).ConfigureAwait(false);
                    }
                    _logger.LogInformation("Unsubscribed");
                }

                _logger.LogInformation("Subscribing...");
                var subscribeResult = await _client.SubscribeAsync(_config.OverrideTopic).ConfigureAwait(false);
                _logger.LogInformation("Subscribed. Subscription count: {count}", subscribeResult?.Subscriptions.Count);

                var result = subscribeResult != null;

                if (result)
                    _logger.LogInformation("Reconnecting and subscribing succeeded");

                return result;
            }
            _logger.LogError("Not connected ({reasonCode} - {reasonString}): {responseInformation}", connectResult.ReasonCode, connectResult.ReasonString, connectResult.ResponseInformation);
        }
        catch (HiveMQttClientException ex)
        {
            _logger.LogError(ex, "Reconnecting failed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Reconnecting failed");
        }
        finally
        {
            _allowReconnect.Release();
            _logger.LogInformation("Semaphore left");
        }
        return false;
    }


    private async ValueTask<bool> ReconnectWithRetryAsync(int maxAttempts, CancellationToken ct = default)
    {
        int delayMs = 100;
        int attemptNo = 0;

        while (!ct.IsCancellationRequested)
        {
            var success = await ReconnectAsync().ConfigureAwait(false);
            if (success)
                return true;

            attemptNo++;
            if (maxAttempts != 0 && attemptNo >= maxAttempts)
                return false;

            await Task.Delay(delayMs, ct).ConfigureAwait(false);

            delayMs = Math.Min(delayMs * 2, 60_000);
        }
        return false;
    }

    public async ValueTask DisposeAsync()
    {
        if (_client?.IsConnected() == true)
            await _client.DisconnectAsync().ConfigureAwait(false);
        _client?.Dispose();
    }

    private static SecureString? ToSecureString(string? plain)
    {
        if (string.IsNullOrEmpty(plain))
            return null;

        var secure = new SecureString();
        foreach (var c in plain)
            secure.AppendChar(c);
        secure.MakeReadOnly();
        return secure;
    }
}
