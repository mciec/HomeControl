using Microsoft.Extensions.Logging;
using System.Threading.Channels;

namespace LedStripeWithSensors.MqttManager;

internal sealed class ChannelManagerWithRecovery
{
    private readonly Channel<IExpiratingAsyncDelegate> _expiratingDelegateChannel;
    private readonly ILogger<ChannelManagerWithRecovery> _logger;
    private Func<CancellationToken, ValueTask<bool>> _recoveryFunc;
    private int _maxAttempts;

    public ChannelManagerWithRecovery(ILogger<ChannelManagerWithRecovery> logger)
    {
        _logger = logger;
        _expiratingDelegateChannel = Channel.CreateUnbounded<IExpiratingAsyncDelegate>();
    }

    public ChannelManagerWithRecovery StartConsumer(Func<CancellationToken, ValueTask<bool>> recoveryAsyncFunc, int maxAttempts, CancellationToken ct = default)
    {
        _maxAttempts = maxAttempts;
        _recoveryFunc = recoveryAsyncFunc;
        var consumerTask = Task.Run(async () =>
        {
            while (!ct.IsCancellationRequested)
            {
                var expiratingDelegate = await _expiratingDelegateChannel.Reader.ReadAsync(ct).ConfigureAwait(false);
                await ConsumeWithRecovery(expiratingDelegate, ct).ConfigureAwait(false);
            }
        }, ct);
        _logger.LogInformation("Consumer started");

        return this;
    }

    public bool Send(IExpiratingAsyncDelegate expiratingDelegate)
    {
        if (_expiratingDelegateChannel == null)
            throw new Exception("Channel not created");

        return _expiratingDelegateChannel.Writer.TryWrite(expiratingDelegate);
    }

    private async ValueTask ConsumeWithRecovery(IExpiratingAsyncDelegate expiratingDelegate, CancellationToken ct)
    {
        int delayMs = 100;
        int attemptNo = 0;
        bool recoveryFuncResult = true;
        bool expiratingDelegateResult = true;
        do
        {
            try
            {
                var now = DateTime.UtcNow;

                if (expiratingDelegate.ExpirationDate < now)
                    return;

                var timeLeftMs = expiratingDelegate.ExpirationDate == null
                    ? 0
                    : (int)(expiratingDelegate.ExpirationDate.Value - now).TotalMilliseconds;

                if (timeLeftMs < 0)
                    return;

                if (attemptNo > 0)
                    recoveryFuncResult = await _recoveryFunc(ct).ConfigureAwait(false);

                if (recoveryFuncResult)
                {
                    expiratingDelegateResult = await expiratingDelegate.Delegate(ct).ConfigureAwait(false);
                    if (expiratingDelegateResult)
                        return;
                }

                attemptNo++;
            }
            catch (Exception ex)
            {
                attemptNo++;
                _logger.LogError(ex, "Error in expirating delegate. Attempt {attempt} / {maxAttempts}", attemptNo, _maxAttempts);
            }

            await Task.Delay(delayMs, ct).ConfigureAwait(false);
            delayMs = Math.Min(delayMs * 2, 6_400);

        } while (!ct.IsCancellationRequested && (_maxAttempts == 0 || attemptNo <= _maxAttempts));
    }
}
