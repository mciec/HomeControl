namespace MqttBroker
{
    using System;
    using System.Linq;
    using System.Text;
    using System.Threading;
    using System.Threading.Tasks;
    using Config;
    using Microsoft.Extensions.Hosting;
    using MQTTnet;
    using MQTTnet.Client;
    using MQTTnet.Client.Options;
    using MQTTnet.Protocol;
    using MQTTnet.Server;
    using NLog;

    public class DeviceManagerService : BackgroundService
    {
        private readonly ILogger<DeviceManagerService> _logger;
        private readonly MqttSenderConfig _config;
        private readonly IMqttClient _mqttSender;
        private static double BytesDivider => 1048576.0;

        public DeviceManagerService(IMqttClient mqttClient, MqttSenderConfig config, ILogger<DeviceManagerService> logger)
        {
            _mqttSender = mqttClient;
            _config = config;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Starting service");

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(_config.DelayInMilliSeconds, cancellationToken);
                    var x = await _mqttSender.PublishAsync(new MqttApplicationMessage()
                    {

                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError($"An error occurred: {ex}");
                }
            }
            _mqttSender?.DisconnectAsync();
        }

        private IMqttClientOptions BuildSenderOptions()
        {
            var optionsBuilder = new MqttClientOptionsBuilder()
                .WithClientId(_config.ClientId)
                .WithCredentials(new MqttClientCredentials() { Username = _config.Users[0].Name, Password = Encoding.ASCII.GetBytes(_config.Users[0].Password) })
                .WithTls(tlsParams =>
                {
                    tlsParams.AllowUntrustedCertificates = true;
                    tlsParams.IgnoreCertificateChainErrors = true;
                });


            return optionsBuilder.Build();
        }

        private void LogMessage(MqttSubscriptionInterceptorContext context, bool successful)
        {
            _logger.LogInformation(successful ?
                $"New subscription: ClientId = {context.ClientId}, TopicFilter = {context.TopicFilter}"
                : $"Subscription failed for clientId = {context.ClientId}, TopicFilter = {context.TopicFilter}");
        }

        private void LogMessage(MqttApplicationMessageInterceptorContext context)
        {
            var payload = context.ApplicationMessage?.Payload == null ? null : Encoding.UTF8.GetString(context.ApplicationMessage.Payload);
            _logger.LogInformation($"Message: ClientId = {context.ClientId}, Topic = {context.ApplicationMessage?.Topic}, Payload = {payload}, QoS = {context.ApplicationMessage?.QualityOfServiceLevel}, Retain-Flag = {context.ApplicationMessage?.Retain}");
        }

        private void LogMessage(MqttConnectionValidatorContext context, bool showPassword)
        {
            if (showPassword)
            {
                _logger.LogInformation($"New connection: ClientId = {context.ClientId}, Endpoint = {context.Endpoint}, Username = {context.Username}, Password = {context.Password}, CleanSession = {context.CleanSession}");
            }
            else
            {
                _logger.LogInformation($"New connection: ClientId = {context.ClientId}, Endpoint = {context.Endpoint}, Username = {context.Username}, CleanSession = {context.CleanSession}");
            }
        }

        private void LogMemoryInformation()
        {
            var totalMemory = GC.GetTotalMemory(false);
            var memoryInfo = GC.GetGCMemoryInfo();
            var divider = BytesDivider;
            _logger.LogInformation($"Heartbeat for service {_config.ServiceName}: Total {(totalMemory / divider):N3}, heap size: {(memoryInfo.HeapSizeBytes / divider):N3}, memory load: {(memoryInfo.MemoryLoadBytes / divider):N3}.");
        }
    }
}