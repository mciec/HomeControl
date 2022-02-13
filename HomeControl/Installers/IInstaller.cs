namespace MqttBroker.Installers
{
    public interface IInstaller
    {
        void InstallService(IServiceCollection serviceCollection, IConfiguration configuration);
    }
}
