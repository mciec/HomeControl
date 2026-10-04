namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// What triggered a LedStripeWithSensors animation: an explicit MQTT override command,
/// or the motion sensors.
/// </summary>
public enum AnimationSource
{
    Override,
    Motion
}
