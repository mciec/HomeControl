using System.Collections.Concurrent;
using Microsoft.Extensions.Options;

namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// Thread-safe, in-memory registry of statically-configured devices and their live state.
/// The device list itself (Id/Name/Type/topics) is immutable after startup; per-device
/// state (today, only LedStripeWithSensors override timestamps) is mutable and guarded
/// by a per-device lock.
/// </summary>
public sealed class DeviceRegistry
{
    private readonly Dictionary<string, DeviceConfigEntry> _devicesById;
    private readonly Dictionary<string, DeviceConfigEntry> _devicesByMotionTopic;
    private readonly ConcurrentDictionary<string, LedStripeWithSensorsState> _ledStripeStates = new();

    public DeviceRegistry(IOptions<List<DeviceConfigEntry>> devicesOptions)
    {
        var devices = devicesOptions.Value ?? new List<DeviceConfigEntry>();

        _devicesById = devices.ToDictionary(d => d.Id, StringComparer.Ordinal);

        _devicesByMotionTopic = devices
            .Where(d => !string.IsNullOrEmpty(d.MotionTopic))
            .ToDictionary(d => d.MotionTopic!, StringComparer.Ordinal);

        foreach (var device in devices)
        {
            if (device.Type == DeviceType.LedStripeWithSensors)
            {
                _ledStripeStates[device.Id] = new LedStripeWithSensorsState();
            }
        }
    }

    public IReadOnlyCollection<DeviceConfigEntry> GetAll() => _devicesById.Values;

    public DeviceConfigEntry? GetConfig(string id) => _devicesById.GetValueOrDefault(id);

    /// <summary>Looks up the device whose MotionTopic matches the given MQTT topic, if any.</summary>
    public DeviceConfigEntry? GetByMotionTopic(string topic) => _devicesByMotionTopic.GetValueOrDefault(topic);

    /// <summary>Returns a point-in-time copy of the device's LedStripeWithSensors state, or null
    /// if the device is unknown or is not of that type.</summary>
    public LedStripeWithSensorsState? GetLedStripeStateSnapshot(string id)
    {
        if (!_ledStripeStates.TryGetValue(id, out var state))
            return null;

        lock (state)
        {
            return Snapshot(state);
        }
    }

    /// <summary>Applies a Started/Stopped animation lifecycle event reported by a device to its
    /// in-memory state, and returns a snapshot of the resulting state (or null if the device is
    /// unknown or is not of that type).
    ///
    /// On <see cref="AnimationEventType.Started"/>, the CurrentAnimation* fields are populated
    /// from the given parameters; the LastOverride{Left,Right}ReceivedUtc timestamp for the
    /// given direction is also bumped to <paramref name="receivedAtUtc"/>, but only when
    /// <paramref name="source"/> is <see cref="AnimationSource.Override"/> — a motion-triggered
    /// start must not count as an override having been received.
    ///
    /// On <see cref="AnimationEventType.Stopped"/>, the CurrentAnimation* fields are cleared back
    /// to null. The LastOverrideReceived* timestamps are never touched on Stopped.</summary>
    public LedStripeWithSensorsState? ApplyAnimationEvent(
        string id,
        AnimationEventType eventType,
        OverrideDirection direction,
        AnimationSource source,
        string? animationName,
        DateTimeOffset? startedAtUtc,
        DateTimeOffset? endsAtUtc,
        DateTimeOffset receivedAtUtc)
    {
        if (!_ledStripeStates.TryGetValue(id, out var state))
            return null;

        lock (state)
        {
            if (eventType == AnimationEventType.Started)
            {
                state.CurrentAnimationName = animationName;
                state.CurrentAnimationDirection = direction;
                state.CurrentAnimationSource = source;
                state.CurrentAnimationStartedAtUtc = startedAtUtc;
                state.CurrentAnimationEndsAtUtc = endsAtUtc;

                if (source == AnimationSource.Override)
                {
                    if (direction == OverrideDirection.Left)
                    {
                        state.LastOverrideLeftReceivedUtc = receivedAtUtc;
                    }
                    else
                    {
                        state.LastOverrideRightReceivedUtc = receivedAtUtc;
                    }
                }
            }
            else
            {
                state.CurrentAnimationName = null;
                state.CurrentAnimationDirection = null;
                state.CurrentAnimationSource = null;
                state.CurrentAnimationStartedAtUtc = null;
                state.CurrentAnimationEndsAtUtc = null;
            }

            return Snapshot(state);
        }
    }

    private static LedStripeWithSensorsState Snapshot(LedStripeWithSensorsState state) => new()
    {
        LastOverrideLeftReceivedUtc = state.LastOverrideLeftReceivedUtc,
        LastOverrideRightReceivedUtc = state.LastOverrideRightReceivedUtc,
        CurrentAnimationName = state.CurrentAnimationName,
        CurrentAnimationDirection = state.CurrentAnimationDirection,
        CurrentAnimationSource = state.CurrentAnimationSource,
        CurrentAnimationStartedAtUtc = state.CurrentAnimationStartedAtUtc,
        CurrentAnimationEndsAtUtc = state.CurrentAnimationEndsAtUtc
    };
}
