using Config;
using MQTTnet;

namespace MqttBroker.Installers
{
    public class DeviceManagerServiceInstaller : IInstaller
    {
        public void InstallService(IServiceCollection services, IConfiguration configuration)
        {
            MqttSenderConfig mqttSenderConfig = new();
            configuration.Bind("MqttSender", mqttSenderConfig);
            services.AddSingleton(mqttSenderConfig);

            services.AddTransient(_ => new MqttFactory().CreateMqttClient());
            services.AddHostedService<DeviceManagerService>();
        }
    }
}
