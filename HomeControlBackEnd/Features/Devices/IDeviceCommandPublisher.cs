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
    /// override topic isn't configured, or if the MQTT client is still not connected after a short wait
    /// (so a request arriving right after a cold start can ride out the broker reconnect).
    /// This is fire-and-forget with respect to the resulting animation — a true result
    /// only means the publish attempt was made while connected, not that the device acted on it.
    /// </summary>
    Task<bool> TryPublishOverrideAsync(string deviceId, OverrideDirection direction, CancellationToken ct);

    /// <summary>
    /// Attempts to publish a command enabling or disabling motion-triggered animations on the
    /// device. Same semantics and false conditions as <see cref="TryPublishOverrideAsync"/>. The
    /// device confirms by publishing its new state, which is what updates the registry.
    /// </summary>
    Task<bool> TryPublishMotionTriggersAsync(string deviceId, bool enabled, CancellationToken ct);
}
