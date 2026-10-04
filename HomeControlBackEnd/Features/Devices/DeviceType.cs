namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Discriminator for the kind of physical device a registry entry represents.
/// Adding a new device type is purely additive: a new enum member, a new state/DTO
/// variant, and a new switch case wherever DeviceType is matched on.
/// </summary>
public enum DeviceType
{
    LedStripeWithSensors
}
