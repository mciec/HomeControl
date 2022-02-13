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
    using MQTTnet.Protocol;
    using MQTTnet.Server;
    using NLog;

    public class MqttBrokerService : BackgroundService
    {
        private readonly ILogger<MqttBrokerService> _logger;
        private static double BytesDivider => 1048576.0;
        private readonly MqttBrokerConfig _config;
        private readonly IMqttServer _mqttServer;
        public MqttBrokerService(IMqttServer mqttServer, MqttBrokerConfig config, ILogger<MqttBrokerService> logger)
        {
            _mqttServer = mqttServer;
            _config = config;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Starting service");

            var options = BuildServerOptions();

            var task = _mqttServer.StartAsync(options);
            await task;

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(_config.DelayInMilliSeconds, cancellationToken);
                    LogMemoryInformation();
                }
                catch (Exception ex)
                {
                    _logger.LogError($"An error occurred: {ex}");
                }
            }
            _mqttServer?.StopAsync();
        }

        private IMqttServerOptions BuildServerOptions()
        {
            var optionsBuilder = new MqttServerOptionsBuilder()
                .WithDefaultEndpoint()
                .WithDefaultEndpointPort(_config.Port)
                .WithEncryptedEndpointPort(_config.TlsPort)
                .WithConnectionValidator(c =>
                {
                    var currentUser = _config.Users.FirstOrDefault(u => u.Name == c.Username);

                    if (currentUser == null)
                    {
                        c.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                        LogMessage(c, true);
                        return;
                    }

                    if (c.Username != currentUser.Name)
                    {
                        c.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                        LogMessage(c, true);
                        return;
                    }

                    if (c.Password != currentUser.Password)
                    {
                        c.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                        LogMessage(c, true);
                        return;
                    }

                    c.ReasonCode = MqttConnectReasonCode.Success;
                    LogMessage(c, false);
                })
                .WithSubscriptionInterceptor(c =>
                {
                    c.AcceptSubscription = true;
                    LogMessage(c, true);
                })
                .WithApplicationMessageInterceptor(c =>
                {
                    c.AcceptPublish = true;
                    LogMessage(c);
                });

            return optionsBuilder.Build();
        }

        /// <summary> 
        ///     Logs the message from the MQTT subscription interceptor context. 
        /// </summary> 
        /// <param name="context">The MQTT subscription interceptor context.</param> 
        /// <param name="successful">A <see cref="bool"/> value indicating whether the subscription was successful or not.</param> 
        private void LogMessage(MqttSubscriptionInterceptorContext context, bool successful)
        {
            _logger.LogInformation(successful ?
                $"New subscription: ClientId = {context.ClientId}, TopicFilter = {context.TopicFilter}"
                : $"Subscription failed for clientId = {context.ClientId}, TopicFilter = {context.TopicFilter}");
        }

        /// <summary>
        ///     Logs the message from the MQTT message interceptor context.
        /// </summary>
        /// <param name="context">The MQTT message interceptor context.</param>
        private void LogMessage(MqttApplicationMessageInterceptorContext context)
        {
            var payload = context.ApplicationMessage?.Payload == null ? null : Encoding.UTF8.GetString(context.ApplicationMessage.Payload);
            _logger.LogInformation($"Message: ClientId = {context.ClientId}, Topic = {context.ApplicationMessage?.Topic}, Payload = {payload}, QoS = {context.ApplicationMessage?.QualityOfServiceLevel}, Retain-Flag = {context.ApplicationMessage?.Retain}");
        }

        /// <summary> 
        ///     Logs the message from the MQTT connection validation context. 
        /// </summary> 
        /// <param name="context">The MQTT connection validation context.</param> 
        /// <param name="showPassword">A <see cref="bool"/> value indicating whether the password is written to the log or not.</param> 
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

        /// <summary>
        /// Logs the heartbeat message with some memory information.
        /// </summary>
        private void LogMemoryInformation()
        {
            var totalMemory = GC.GetTotalMemory(false);
            var memoryInfo = GC.GetGCMemoryInfo();
            var divider = BytesDivider;
            _logger.LogInformation($"Heartbeat for service {_config.ServiceName}: Total {(totalMemory / divider):N3}, heap size: {(memoryInfo.HeapSizeBytes / divider):N3}, memory load: {(memoryInfo.MemoryLoadBytes / divider):N3}.");
        }
    }
}