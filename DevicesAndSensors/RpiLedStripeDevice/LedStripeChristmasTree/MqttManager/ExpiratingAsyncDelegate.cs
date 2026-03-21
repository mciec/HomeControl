namespace LedStripeChristmasTree.MqttManager;

internal class ExpiratingAsyncDelegate : IExpiratingAsyncDelegate
{
    public Func<CancellationToken, ValueTask<bool>> Delegate { get; set; } = null!;
    public DateTime? ExpirationDate { get; set; }
}
