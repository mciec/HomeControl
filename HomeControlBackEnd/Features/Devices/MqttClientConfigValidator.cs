using Microsoft.Extensions.Options;
using MqttManager;

namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Fails host startup with an actionable message when the "Mqtt" configuration section is
/// incomplete, instead of letting the broker connection crash later with an opaque
/// HiveMqttClientException. Host/User/Password are secrets and never live in appsettings.json:
/// locally they come from `dotnet user-secrets`, in Azure from app settings (Mqtt__Host, ...).
/// </summary>
public sealed class MqttClientConfigValidator : IValidateOptions<MqttClientConfig>
{
    private const string Hint =
        "Set it with `dotnet user-secrets set \"Mqtt:{0}\" <value> --project HomeControlBackEnd` locally, "
        + "or the `Mqtt__{0}` environment variable / App Service app setting when deployed.";

    public ValidateOptionsResult Validate(string? name, MqttClientConfig options)
    {
        var failures = new List<string>();

        void Require(string key, string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                failures.Add($"Mqtt:{key} is not set. {string.Format(Hint, key)}");
        }

        Require(nameof(options.ClientId), options.ClientId);
        Require(nameof(options.Host), options.Host);
        Require(nameof(options.User), options.User);
        Require(nameof(options.Password), options.Password);

        if (options.Port is < 1 or > 65535)
            failures.Add($"Mqtt:Port must be between 1 and 65535 (was {options.Port}).");

        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }
}
