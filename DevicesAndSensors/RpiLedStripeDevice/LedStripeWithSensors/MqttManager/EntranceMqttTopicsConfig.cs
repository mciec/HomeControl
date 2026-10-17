namespace LedStripeWithSensors.MqttManager;

internal sealed class EntranceMqttTopicsConfig
{
    public string OverrideTopic { get; set; } = "entrance/override";
    public string MotionDetectedTopic { get; set; } = "entrance/motion";

    /// <summary>Commands (payload "ON"/"OFF") enabling or disabling animations triggered by the motion sensors.</summary>
    public string MotionTriggersSetTopic { get; set; } = "entrance/motion-triggers/set";

    /// <summary>Current state ("ON"/"OFF") of motion-triggered animations; published retained by the device.</summary>
    public string MotionTriggersStateTopic { get; set; } = "entrance/motion-triggers";
}
