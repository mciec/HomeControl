using System.Security;
using HiveMQtt.Client;
using HiveMQtt.Client.Exceptions;
using HiveMQtt.Client.Options;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MqttManager;

public sealed class MqttClient : IAsyncDisposable
{
    private readonly SemaphoreSlim _allowReconnect;

    private readonly MqttClientConfig _config;
    private readonly ChannelManagerWithRecovery _channelManagerWithRecovery;
    private readonly ILogger<MqttClient> _logger;
    private HiveMQClient _client = null!;
    private IReadOnlyCollection<string> _subscribeTopics = Array.Empty<string>();

    public MqttClient(IOptions<MqttClientConfig> config, ChannelManagerWithRecovery channelManagerWithRecovery, ILogger<MqttClient> logger)
    {
        _config = config.Value;
        _channelManagerWithRecovery = channelManagerWithRecovery;
        _logger = logger;
        _allowReconnect = new SemaphoreSlim(1);
    }

    public event EventHandler<MqttMessageReceivedEventArgs>? MessageReceived;

    public bool IsConnected => _client?.IsConnected() == true;

    public MqttClient Connect(IReadOnlyCollection<string> subscribeTopics, CancellationToken ct)
    {
        _subscribeTopics = subscribeTopics;

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
            MessageReceived?.Invoke(this, new MqttMessageReceivedEventArgs(args.PublishMessage.Topic, args.PublishMessage.PayloadAsString));
        };

        _client.AfterDisconnect += async (sender, args) =>
        {
            _logger.LogError("MQTT client disconnected.");
            await ReconnectWithRetryAsync(0, ct).ConfigureAwait(false);
        };

        _ = ReconnectWithRetryAsync(0, ct);

        return this;
    }

    public void Publish(string topic, string message)
    {
        if (_channelManagerWithRecovery is null)
            throw new Exception("Channel manager not created");

        _channelManagerWithRecovery.Send(new ExpiratingAsyncDelegate()
        {
            Delegate = async (CancellationToken ct) =>
            {
                _logger.LogInformation("Sending message: {message} to topic: {topic}", message, topic);
                var result = await _client.PublishAsync(topic, message).ConfigureAwait(false);
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
                _logger.LogDebug("Semaphore is taken.");
                return false;
            }

            _logger.LogDebug("Inside semaphore");

            if (_client.IsConnected())
            {
                _logger.LogDebug("Already connected");
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

                var result = true;

                if (_subscribeTopics.Count > 0)
                {
                    _logger.LogInformation("Subscribing...");
                    foreach (var topic in _subscribeTopics)
                    {
                        var subscribeResult = await _client.SubscribeAsync(topic).ConfigureAwait(false);
                        _logger.LogInformation("Subscribed. Subscription count: {count}", subscribeResult?.Subscriptions.Count);
                        result &= subscribeResult != null;
                    }
                }

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
            _logger.LogDebug("Semaphore exited");
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
