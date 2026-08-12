namespace HomeControlBackEnd.Features.Devices;

/// <summary>GET /api/devices list item.</summary>
public sealed record DeviceSummaryDto(string Id, string Name, DeviceType Type);

/// <summary>State shape for a LedStripeWithSensors device, used both in the GET detail
/// response's "state" property and in the SignalR DeviceStateChanged push's "state" property,
/// so the frontend can reuse one type/merge logic for both.</summary>
public sealed record LedStripeWithSensorsStateDto(
    DateTimeOffset? LastOverrideLeftReceivedUtc,
    DateTimeOffset? LastOverrideRightReceivedUtc);

/// <summary>GET /api/devices/{id} response. "State" shape depends on "Type".</summary>
public sealed record DeviceDetailDto(string Id, string Name, DeviceType Type, object State);

/// <summary>SignalR "DeviceStateChanged" push payload.</summary>
public sealed record DeviceStateChangedMessage(string DeviceId, DeviceType Type, object State);

/// <summary>POST /api/devices/{id}/override request body. Direction is bound as a raw
/// string (rather than the OverrideDirection enum directly) so a missing/invalid value
/// can be reported with the contracted `{ "message": "..." }` shape instead of the
/// framework's default validation-problem response.</summary>
public sealed record OverrideRequestDto(string? Direction);
