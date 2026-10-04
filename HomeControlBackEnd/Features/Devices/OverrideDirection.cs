namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Direction of a manual override command sent to a device, and the direction
/// resolved from a normalized motion/echo signal received back from a device.
/// </summary>
public enum OverrideDirection
{
    Left,
    Right
}
