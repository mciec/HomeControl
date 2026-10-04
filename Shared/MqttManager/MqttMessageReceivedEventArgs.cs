namespace MqttManager;

public sealed class MqttMessageReceivedEventArgs : EventArgs
{
    public MqttMessageReceivedEventArgs(string topic, string payload)
    {
        Topic = topic;
        Payload = payload;
    }

    public string Topic { get; }
    public string Payload { get; }
}
