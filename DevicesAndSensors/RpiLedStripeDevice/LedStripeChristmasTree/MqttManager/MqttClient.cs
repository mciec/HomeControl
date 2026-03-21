using HiveMQtt.Client;
using HiveMQtt.Client.Exceptions;
using HiveMQtt.Client.Options;
using LedStripeChristmasTree.Animations;
using Microsoft.Extensions.Options;

namespace LedStripeChristmasTree.MqttManager;

internal sealed class MqttClient : IAsyncDisposable
{
    private readonly SemaphoreSlim _allowReconnect;

    private readonly MqttClientConfig _config;
    private HiveMQClient _client;
    private ChannelManagerWithRecovery _channelManager;

    public MqttClient(IOptions<MqttClientConfig> config)
    {
        _config = config.Value;
        _allowReconnect = new SemaphoreSlim(1);
    }

    public MqttClient Connect(Action<Type> onSwitchAnimation, CancellationToken ct)
    {
        var options = new HiveMQClientOptions
        {
            ClientId = _config.ClientId,
            Host = _config.Host,
            Port = _config.Port,
            UseTLS = _config.UseTLS,
            UserName = _config.User,
            Password = _config.Password,
        };

        _channelManager = ChannelManagerWithRecovery.StartConsumer(
            recoveryAsyncFunc: async (CancellationToken ct) => await ReconnectAsync().ConfigureAwait(false),
            maxAttempts: 0,
            ct);

        _client = new HiveMQClient(options);

        _client.OnMessageReceived += (sender, args) =>
        {
            string payload = args.PublishMessage.PayloadAsString.ToUpper();
            switch (payload)
            {
                case nameof(FlyingBallsAnimation): onSwitchAnimation(typeof(FlyingBallsAnimation)); break;
                default: break;
            }
        };

        _client.AfterDisconnect += async (sender, args) =>
        {
            await ReconnectWithRetryAsync(0, ct).ConfigureAwait(false);
        };

        _ = ReconnectWithRetryAsync(0, ct);

        return this;
    }

    private async ValueTask<bool> ReconnectAsync()
    {
        if (_client.IsConnected())
            return true;

        if (!await _allowReconnect.WaitAsync(1000).ConfigureAwait(false))
            return false;

        try
        {
            var connectResult = await _client.ConnectAsync().ConfigureAwait(false);
            if (connectResult.ReasonCode == HiveMQtt.MQTT5.ReasonCodes.ConnAckReasonCode.Success)
            {
                foreach (var sub in _client.Subscriptions)
                {
                    await _client.UnsubscribeAsync(sub).ConfigureAwait(false);
                }
                var subscribeResult = await _client.SubscribeAsync(_config.ChangeAnimationTopic).ConfigureAwait(false);
                return subscribeResult != null;
            }
        }
        catch (HiveMQttClientException ex)
        {
            Console.WriteLine(ex.Message);
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex.Message);
        }
        finally
        {
            _allowReconnect.Release();
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

            await Task.Delay(delayMs).ConfigureAwait(false);

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
}
