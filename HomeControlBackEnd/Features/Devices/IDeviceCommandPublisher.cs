namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Publishes commands to devices over MQTT. Implemented by the MQTT-backed hosted
/// service; injected into the controller so it stays decoupled from MQTT specifics.
/// </summary>
public interface IDeviceCommandPublisher
{
    /// <summary>
    /// Attempts to publish an override command for the given device and direction.
    /// Returns false if the device/type doesn't support overrides, if the device's
    /// override topic isn't configured, or if the MQTT client is not currently connected.
    /// This is fire-and-forget with respect to the resulting animation — a true result
    /// only means the publish attempt was made while connected, not that the device acted on it.
    /// </summary>
    Task<bool> TryPublishOverrideAsync(string deviceId, OverrideDirection direction, CancellationToken ct);
}
