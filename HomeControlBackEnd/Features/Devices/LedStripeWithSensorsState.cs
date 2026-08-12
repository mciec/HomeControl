namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// In-memory, per-device live state for a LedStripeWithSensors device. Not persisted;
/// resets to all-null on backend restart. Mutated only through <see cref="DeviceRegistry"/>,
/// which guards access with a lock on the instance.
/// </summary>
public sealed class LedStripeWithSensorsState
{
    public DateTimeOffset? LastOverrideLeftReceivedUtc { get; set; }

    public DateTimeOffset? LastOverrideRightReceivedUtc { get; set; }
}
