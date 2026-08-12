namespace LedStripeWithSensors.MqttManager;

internal sealed class EntranceMqttTopicsConfig
{
    public string OverrideTopic { get; set; } = "entrance/override";
    public string MotionDetectedTopic { get; set; } = "entrance/motion";
}
