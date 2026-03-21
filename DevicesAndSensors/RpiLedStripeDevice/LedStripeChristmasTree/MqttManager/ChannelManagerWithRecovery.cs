using System.Threading.Channels;

namespace LedStripeChristmasTree.MqttManager;

internal sealed class ChannelManagerWithRecovery
{
    private readonly Func<CancellationToken, ValueTask<bool>> _recoveryFunc;
    private readonly int _maxAttempts;
    private readonly Channel<IExpiratingAsyncDelegate> _expiratingDelegateChannel;

    private ChannelManagerWithRecovery(Func<CancellationToken, ValueTask<bool>> recoveryFunc, int maxAttempts)
    {
        _recoveryFunc = recoveryFunc;
        _maxAttempts = maxAttempts;
        _expiratingDelegateChannel = Channel.CreateUnbounded<IExpiratingAsyncDelegate>();
    }

    public static ChannelManagerWithRecovery StartConsumer(Func<CancellationToken, ValueTask<bool>> recoveryAsyncFunc, int maxAttempts, CancellationToken ct = default)
    {
        var channelManager = new ChannelManagerWithRecovery(recoveryAsyncFunc, maxAttempts);
        var consumerTask = Task.Run(async () =>
        {
            while (!ct.IsCancellationRequested)
            {
                var expiratingDelegate = await channelManager._expiratingDelegateChannel.Reader.ReadAsync(ct).ConfigureAwait(false);
                await channelManager.ConsumeWithRecovery(expiratingDelegate, ct).ConfigureAwait(false);
            }
        }, ct);
        return channelManager;
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
                if (expiratingDelegate.ExpirationDate > DateTime.Now)
                    return;

                var now = DateTime.UtcNow;
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
                Console.WriteLine(ex);
                attemptNo++;
            }

            await Task.Delay(delayMs, ct).ConfigureAwait(false);
            delayMs = Math.Min(delayMs * 2, 6_400);

        } while (!ct.IsCancellationRequested && (_maxAttempts == 0 || attemptNo <= _maxAttempts));
    }
}
