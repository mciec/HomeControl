namespace LedStripeChristmasTree.MqttManager;
internal sealed class MqttClientConfig
{
    public string ClientId { get; set; }
    public string Host { get; set; }
    public int Port { get; set; }
    public string User { get; set; }
    public string Password { get; set; }
    public bool UseTLS { get; set; }
    public string ChangeAnimationTopic { get; set; } = @"christmas/animation";
}

