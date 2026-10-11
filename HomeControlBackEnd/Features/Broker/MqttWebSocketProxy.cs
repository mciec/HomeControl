using System.Net.WebSockets;

namespace HomeControlBackEnd.Features.Broker;

/// <summary>
/// Exposes the embedded Mosquitto broker to the outside as MQTT over secure WebSocket at <c>/mqtt</c>.
/// The platform ingress only forwards HTTP(S), so this is the (TLS-encrypted, port 443) way for the
/// Raspberry Pi device - or a web/mobile MQTT client - to reach a broker that listens on loopback only.
/// Each accepted WebSocket is piped, message for message, to Mosquitto's own WebSocket listener;
/// authentication and per-topic authorization stay with the broker (users + aclfile), so this endpoint
/// deliberately adds none of its own. Registered only when <c>Broker:WebSocketTarget</c> is configured
/// (the container entrypoint sets it when it starts the embedded broker).
/// </summary>
public static class MqttWebSocketProxy
{
    private const string SubProtocol = "mqtt";
    private const int BufferSize = 16 * 1024;

    public static IApplicationBuilder UseMqttWebSocketProxy(this WebApplication app, string path, Uri target)
    {
        var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("HomeControl.MqttProxy");
        app.UseWebSockets();
        app.Map(path, branch => branch.Run(async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            var requested = context.WebSockets.WebSocketRequestedProtocols;
            using var client = await context.WebSockets.AcceptWebSocketAsync(
                requested.Contains(SubProtocol) ? SubProtocol : null);

            using var upstream = new ClientWebSocket();
            upstream.Options.AddSubProtocol(SubProtocol);
            try
            {
                await upstream.ConnectAsync(target, context.RequestAborted);
            }
            catch (Exception ex) when (ex is WebSocketException or HttpRequestException or OperationCanceledException)
            {
                log.LogWarning(ex, "Cannot reach the embedded MQTT broker at {Target}.", target);
                await CloseQuietly(client, WebSocketCloseStatus.InternalServerError, "broker unavailable");
                return;
            }

            log.LogInformation("MQTT WebSocket client connected from {Remote}.", context.Connection.RemoteIpAddress);
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
            var pumps = new[]
            {
                Pump(client, upstream, cts.Token),
                Pump(upstream, client, cts.Token),
            };

            // When either side goes away, tear down the other so neither pump is left hanging.
            await Task.WhenAny(pumps);
            await cts.CancelAsync();
            await Task.WhenAll(pumps.Select(p => p.ContinueWith(_ => { }, TaskScheduler.Default)));
            log.LogInformation("MQTT WebSocket client from {Remote} disconnected.", context.Connection.RemoteIpAddress);
        }));
        return app;
    }

    private static async Task Pump(WebSocket from, WebSocket to, CancellationToken ct)
    {
        var buffer = new byte[BufferSize];
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var result = await from.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await CloseQuietly(to, result.CloseStatus ?? WebSocketCloseStatus.NormalClosure, result.CloseStatusDescription);
                    return;
                }

                await to.SendAsync(buffer.AsMemory(0, result.Count), result.MessageType, result.EndOfMessage, ct);
            }
        }
        catch (Exception ex) when (ex is WebSocketException or OperationCanceledException or ObjectDisposedException)
        {
            // Peer vanished or the other direction finished first - the caller tears everything down.
        }
    }

    private static async Task CloseQuietly(WebSocket socket, WebSocketCloseStatus status, string? description)
    {
        try
        {
            if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                await socket.CloseOutputAsync(status, description, CancellationToken.None);
        }
        catch (Exception ex) when (ex is WebSocketException or ObjectDisposedException)
        {
        }
    }
}
