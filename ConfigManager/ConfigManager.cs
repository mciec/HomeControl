using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Config
{
    public static class ConfigManager
    {
        private static string EnvironmentName => Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        public static IConfigurationRoot GetConfig()
        {
            const string configFileName = "mqttBrokerConfig";
            var configurationBuilder = new ConfigurationBuilder();
            configurationBuilder.AddJsonFile($"{configFileName}.json", false, true);

            if (!string.IsNullOrWhiteSpace(EnvironmentName))
            {
                var appsettingsFileName = $"{configFileName}.{EnvironmentName}.json";

                if (File.Exists(appsettingsFileName))
                {
                    configurationBuilder.AddJsonFile(appsettingsFileName, false, true);
                }
            }

            return configurationBuilder.Build();
        }
    }
}
