using NLog;
using NLog.Extensions.Logging;

namespace MqttBroker.Installers
{
    public class NLogInstaller : IInstaller
    {
        public void InstallService(IServiceCollection services, IConfiguration configuration)
        {
            LogManager.Configuration = new NLogLoggingConfiguration(configuration.GetSection("NLog"));

        }

    }
}


