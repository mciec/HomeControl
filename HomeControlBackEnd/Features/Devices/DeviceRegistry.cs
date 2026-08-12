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

    /// <summary>Records that an override signal for the given direction was received for the
    /// device at the given timestamp, and returns a snapshot of the resulting state
    /// (or null if the device is unknown or is not of that type).</summary>
    public LedStripeWithSensorsState? UpdateLedStripeOverrideReceived(string id, OverrideDirection direction, DateTimeOffset receivedAtUtc)
    {
        if (!_ledStripeStates.TryGetValue(id, out var state))
            return null;

        lock (state)
        {
            if (direction == OverrideDirection.Left)
            {
                state.LastOverrideLeftReceivedUtc = receivedAtUtc;
            }
            else
            {
                state.LastOverrideRightReceivedUtc = receivedAtUtc;
            }

            return Snapshot(state);
        }
    }

    private static LedStripeWithSensorsState Snapshot(LedStripeWithSensorsState state) => new()
    {
        LastOverrideLeftReceivedUtc = state.LastOverrideLeftReceivedUtc,
        LastOverrideRightReceivedUtc = state.LastOverrideRightReceivedUtc
    };
}
