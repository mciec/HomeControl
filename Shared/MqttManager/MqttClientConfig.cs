namespace MqttManager;
public sealed class MqttClientConfig
{
    public string ClientId { get; set; }
    public string Host { get; set; }
    public int Port { get; set; }
    public string User { get; set; }
    public string Password { get; set; }
    public bool UseTLS { get; set; }

    /// <summary>When set (e.g. wss://host/mqtt), connect with MQTT over WebSocket to this URI instead of
    /// plain TCP to <see cref="Host"/>:<see cref="Port"/>. Needed where only HTTPS (443) is reachable.</summary>
    public string? WebSocketServer { get; set; }
}
