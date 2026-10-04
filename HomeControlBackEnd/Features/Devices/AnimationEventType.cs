namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Kind of animation lifecycle event reported by a device on its motion topic. An internal
/// implementation detail of how <see cref="DeviceMqttListenerService"/> drives
/// <see cref="DeviceRegistry.ApplyAnimationEvent"/> — public only because it appears in that
/// method's signature, but never exposed in a DTO to the frontend.
/// </summary>
public enum AnimationEventType
{
    Started,
    Stopped
}
