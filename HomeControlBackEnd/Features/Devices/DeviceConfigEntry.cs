namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// One entry of the statically-configured device registry, bound from the
/// "Devices" configuration array. Type-agnostic core fields (Id/Name/Type) plus
/// extra fields specific to today's only device type (LedStripeWithSensors).
/// A future device type would add its own extra nullable fields here (or, if the
/// registry grows large, split into a type-specific config class) without
/// touching the existing ones.
/// </summary>
public sealed class DeviceConfigEntry
{
    public string Id { get; set; } = "";

    public string Name { get; set; } = "";

    public DeviceType Type { get; set; }

    // LedStripeWithSensors-specific configuration.
    public string? OverrideTopic { get; set; }

    public string? MotionTopic { get; set; }
}
