namespace LedStripeChristmasTree.MqttManager;

internal interface IExpiratingAsyncDelegate
{
    Func<CancellationToken, ValueTask<bool>> Delegate { get; set; }
    DateTime? ExpirationDate { get; set; }
}
