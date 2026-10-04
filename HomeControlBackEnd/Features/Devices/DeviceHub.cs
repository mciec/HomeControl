using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Connections.Features;
using Microsoft.AspNetCore.SignalR;

namespace HomeControlBackEnd.Features.Devices;

/// <summary>
/// SignalR hub for pushing live device state updates to connected clients.
/// No client-invokable methods are exposed; clients only listen for the
/// "DeviceStateChanged" server-to-client message. Connects/disconnects are logged (with the
/// negotiated transport) so a client that "never receives updates" can be told apart from one
/// that was never connected - broadcasting to zero clients otherwise looks identical in the logs.
/// </summary>
[Authorize]
public sealed class DeviceHub : Hub
{
    private readonly ILogger<DeviceHub> _logger;

    public DeviceHub(ILogger<DeviceHub> logger)
    {
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        var http = Context.GetHttpContext();
        _logger.LogInformation(
            "Hub client connected: {ConnectionId}, transport {Transport}, user {User}, agent '{Agent}'",
            Context.ConnectionId,
            http?.Features.Get<IHttpTransportFeature>()?.TransportType,
            Context.User?.Identity?.Name ?? "?",
            http?.Request.Headers.UserAgent.ToString());
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "Hub client disconnected: {ConnectionId}{Reason}",
            Context.ConnectionId,
            exception is null ? "" : $" ({exception.GetType().Name}: {exception.Message})");
        return base.OnDisconnectedAsync(exception);
    }
}
