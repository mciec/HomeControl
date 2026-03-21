namespace LedStripeWithSensors.AnimationManager;

internal sealed class AnimationManagerConfig
{
    public int FrameDurationMs { get; set; } = 100;
    public int SwitchOffDelaySec { get; set; } = 20;
    public bool DontRunAtDaylight { get; set; } = true;
}
