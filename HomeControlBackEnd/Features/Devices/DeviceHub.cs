using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// SignalR hub for pushing live device state updates to connected clients.
/// No client-invokable methods are exposed; clients only listen for the
/// "DeviceStateChanged" server-to-client message.
/// </summary>
[Authorize]
public sealed class DeviceHub : Hub
{
}
