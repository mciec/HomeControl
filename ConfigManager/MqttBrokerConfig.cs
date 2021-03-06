namespace Config
{
    public class MqttBrokerConfig
    {
        public string ServiceName { get; set; } = "Mqtt broker service";
        public int Port { get; set; } = 1883;
        public List<User> Users { get; set; } = new();
        public int DelayInMilliSeconds { get; set; } = 30000;
        public int TlsPort { get; set; } = 8883;
        public bool IsValid()
        {
            if (Port is <= 0 or > 65535)
            {
                throw new Exception("The port is invalid");
            }

            if (!Users.Any())
            {
                throw new Exception("The users are invalid");
            }

            if (DelayInMilliSeconds <= 0)
            {
                throw new Exception("The heartbeat delay is invalid");
            }

            if (TlsPort is <= 0 or > 65535)
            {
                throw new Exception("The TLS port is invalid");
            }

            return true;
        }
    }
}