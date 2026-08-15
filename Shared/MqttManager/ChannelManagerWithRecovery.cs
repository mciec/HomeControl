using Microsoft.Extensions.Logging;
using Polly;
using Polly.Retry;
using System.Threading.Channels;

namespace MqttManager;

public sealed class ChannelManagerWithRecovery
{
    private readonly Channel<IExpiratingAsyncDelegate> _expiratingDelegateChannel;
    private readonly ILogger<ChannelManagerWithRecovery> _logger;
    private Func<CancellationToken, ValueTask<bool>> _recoveryFunc;
    private ResiliencePipeline<bool> _retryPipeline;
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
        _retryPipeline = new ResiliencePipelineBuilder<bool>()
            .AddRetry(new RetryStrategyOptions<bool>
            {
                ShouldHandle = new PredicateBuilder<bool>()
                    .Handle<Exception>(ex => ex is not OperationCanceledException)
                    .HandleResult(false),
                MaxRetryAttempts = maxAttempts == 0 ? int.MaxValue : maxAttempts,
                Delay = TimeSpan.FromMilliseconds(100),
                BackoffType = DelayBackoffType.Exponential,
                MaxDelay = TimeSpan.FromMilliseconds(6_400),
                UseJitter = false,
                OnRetry = (args) =>
                {
                    if (args.Outcome.Exception is { } ex)
                        _logger.LogError(ex, "Error in expirating delegate. Attempt {attempt} / {maxAttempts}", args.AttemptNumber + 1, _maxAttempts);
                    return default;
                },
            })
            .Build();

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
            throw new ApplicationException("Channel not created");

        return _expiratingDelegateChannel.Writer.TryWrite(expiratingDelegate);
    }

    private async ValueTask ConsumeWithRecovery(IExpiratingAsyncDelegate expiratingDelegate, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        if (expiratingDelegate.ExpirationDate < now)
            return;

        // Expiration timeout: cancel all pending retries once the delegate's expiration date passes.
        using var expirationCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        if (expiratingDelegate.ExpirationDate is { } expirationDate)
            expirationCts.CancelAfter(expirationDate - now);

        int attemptNo = 0;
        try
        {
            await _retryPipeline.ExecuteAsync(async token =>
            {
                // On retries, run the recovery function first; a failed recovery counts as a failed attempt.
                if (attemptNo++ > 0 && !await _recoveryFunc(token).ConfigureAwait(false))
                    return false;

                return await expiratingDelegate.Delegate(token).ConfigureAwait(false);
            }, expirationCts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (expirationCts.IsCancellationRequested && !ct.IsCancellationRequested)
        {
            // Delegate expired while retrying — drop it.
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Retries exhausted with an exception — log and drop, keeping the consumer alive.
            _logger.LogError(ex, "Error in expirating delegate. Attempt {attempt} / {maxAttempts}", attemptNo, _maxAttempts);
        }
    }
}
