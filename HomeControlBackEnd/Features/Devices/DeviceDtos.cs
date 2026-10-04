namespace HomeControlBackEnd.Features.Devices;

/// <summary>GET /api/devices list item.</summary>
public sealed record DeviceSummaryDto(string Id, string Name, DeviceType Type);

/// <summary>State shape for a LedStripeWithSensors device, used both in the GET detail
/// response's "state" property and in the SignalR DeviceStateChanged push's "state" property,
/// so the frontend can reuse one type/merge logic for both.</summary>
public sealed record LedStripeWithSensorsStateDto(
    DateTimeOffset? LastOverrideLeftReceivedUtc,
    DateTimeOffset? LastOverrideRightReceivedUtc,
    CurrentAnimationDto? CurrentAnimation,
    DateTimeOffset ServerTimeUtc)
{
    /// <summary>Maps a <see cref="LedStripeWithSensorsState"/> snapshot to its DTO shape.
    /// Shared by the REST detail endpoint and the SignalR push so both stay in sync.
    /// <see cref="ServerTimeUtc"/> is stamped at mapping time: clients use it to measure their
    /// clock offset from the server and so evaluate <c>StartedAtUtc</c>/<c>EndsAtUtc</c>
    /// (device-reported, server-validated) in server time, never against their own clock.</summary>
    public static LedStripeWithSensorsStateDto FromState(LedStripeWithSensorsState state) =>
        new(
            state.LastOverrideLeftReceivedUtc,
            state.LastOverrideRightReceivedUtc,
            state.CurrentAnimationName is null
                ? null
                : new CurrentAnimationDto(
                    state.CurrentAnimationName,
                    state.CurrentAnimationDirection!.Value,
                    state.CurrentAnimationSource!.Value,
                    state.CurrentAnimationStartedAtUtc!.Value,
                    state.CurrentAnimationEndsAtUtc!.Value),
            DateTimeOffset.UtcNow);
}

/// <summary>Describes the animation currently running on a LedStripeWithSensors device.
/// Absent (null) on the enclosing <see cref="LedStripeWithSensorsStateDto.CurrentAnimation"/>
/// when the device is idle.</summary>
public sealed record CurrentAnimationDto(
    string AnimationName,
    OverrideDirection Direction,
    AnimationSource Source,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset EndsAtUtc);

/// <summary>GET /api/devices/{id} response. "State" shape depends on "Type".</summary>
public sealed record DeviceDetailDto(string Id, string Name, DeviceType Type, object State);

/// <summary>SignalR "DeviceStateChanged" push payload.</summary>
public sealed record DeviceStateChangedMessage(string DeviceId, DeviceType Type, object State);

/// <summary>POST /api/devices/{id}/override request body. Direction is bound as a raw
/// string (rather than the OverrideDirection enum directly) so a missing/invalid value
/// can be reported with the contracted `{ "message": "..." }` shape instead of the
/// framework's default validation-problem response.</summary>
public sealed record OverrideRequestDto(string? Direction);
