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

    /// <summary>The five CurrentAnimation* fields are all null together when idle, and all
    /// set together while an animation is running.</summary>
    public string? CurrentAnimationName { get; set; }

    public OverrideDirection? CurrentAnimationDirection { get; set; }

    public AnimationSource? CurrentAnimationSource { get; set; }

    public DateTimeOffset? CurrentAnimationStartedAtUtc { get; set; }

    public DateTimeOffset? CurrentAnimationEndsAtUtc { get; set; }
}
