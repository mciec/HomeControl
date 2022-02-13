using Config;
using MQTTnet;

namespace MqttBroker.Installers
{
    public class MqttBrokerServiceInstaller : IInstaller
    {
        public void InstallService(IServiceCollection services, IConfiguration configuration)
        {
            MqttBrokerConfig mqttBrokerConfig = new MqttBrokerConfig();
            configuration.Bind("SimpleMqttServer", mqttBrokerConfig);
            services.AddSingleton(mqttBrokerConfig);

            services.AddSingleton(_ => new MqttFactory().CreateMqttServer());
            services.AddHostedService<MqttBrokerService>();
        }

    }
}


