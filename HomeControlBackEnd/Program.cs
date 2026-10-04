using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.HttpOverrides;
using System.Security.Claims;
using System.Text.Json.Serialization;
using HomeControlBackEnd.Features.Devices;
using Microsoft.Extensions.Options;
using MqttManager;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddSignalR()
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Devices feature: config binding, in-memory registry, and the MQTT-backed hosted service
// Mqtt:Host/User/Password are secrets (user secrets locally, app settings in Azure); validated
// at startup so a missing one fails fast with a message saying where to set it.
builder.Services.AddOptions<MqttClientConfig>()
    .Bind(builder.Configuration.GetSection("Mqtt"))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<MqttClientConfig>, MqttClientConfigValidator>();
builder.Services.Configure<List<DeviceConfigEntry>>(builder.Configuration.GetSection("Devices"));
builder.Services.AddSingleton<DeviceRegistry>();
builder.Services.AddSingleton<ChannelManagerWithRecovery>();
builder.Services.AddSingleton<MqttClient>();
builder.Services.AddSingleton<DeviceMqttListenerService>();
builder.Services.AddSingleton<IDeviceCommandPublisher>(sp => sp.GetRequiredService<DeviceMqttListenerService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<DeviceMqttListenerService>());

// Add CORS for development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var isDevelopment = builder.Environment.IsDevelopment();
        var allowedOrigins = isDevelopment
            ? ["http://localhost:3000", "https://localhost:3000", "https://localhost:7000"]
            : Array.Empty<string>();

        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Add authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = GoogleDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.LoginPath = "/signin";
    options.LogoutPath = "/signout";
    options.ExpireTimeSpan = TimeSpan.FromDays(1);
    options.SlidingExpiration = true;
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
})
.AddGoogle(options =>
{
    options.ClientId = builder.Configuration["Google:ClientId"] ?? "";
    options.ClientSecret = builder.Configuration["Google:ClientSecret"] ?? "";
    options.CallbackPath = "/signin-google";
    options.SaveTokens = true;
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Google sign-in cannot work without its credentials. Locally that's only a warning (the app
// still runs, nobody can log in); a deployed instance without them is misconfigured, so fail fast.
if (string.IsNullOrWhiteSpace(builder.Configuration["Google:ClientId"])
    || string.IsNullOrWhiteSpace(builder.Configuration["Google:ClientSecret"]))
{
    const string googleHint = "Google:ClientId / Google:ClientSecret are not set. Set them with "
        + "`dotnet user-secrets set \"Google:ClientId\" <value> --project HomeControlBackEnd` locally, "
        + "or the Google__ClientId / Google__ClientSecret environment variables / App Service app settings when deployed.";
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException(googleHint);
    app.Logger.LogWarning("{Hint} Login will not work until they are.", googleHint);
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
else
{
    var forwardedHeadersOptions = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedProto
    };
    forwardedHeadersOptions.KnownIPNetworks.Clear();
    forwardedHeadersOptions.KnownProxies.Clear();
    app.UseForwardedHeaders(forwardedHeadersOptions);
}
app.UseCors("AllowFrontend");

// One log line per hub / devices request (hub requests also when they *start*, since a
// long-poll can stay open for ~90 s) - the live-update path is otherwise invisible because
// "Microsoft.AspNetCore" is capped at Warning and App Service cannot override dotted log
// categories through environment variables.
var requestLog = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("HomeControl.Requests");
app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    var isHub = path.StartsWithSegments("/hubs");
    if (!isHub && !path.StartsWithSegments("/api/devices"))
    {
        await next();
        return;
    }

    var agent = context.Request.Headers.UserAgent.ToString();
    if (isHub)
        requestLog.LogInformation("-> {Method} {Path}{Query} agent '{Agent}'", context.Request.Method, path, context.Request.QueryString, agent);

    var started = System.Diagnostics.Stopwatch.GetTimestamp();
    await next();
    requestLog.LogInformation(
        "<- {Method} {Path} {Status} in {Elapsed:F0} ms (user {User}, agent '{Agent}')",
        context.Request.Method, path, context.Response.StatusCode,
        System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds,
        context.User.Identity?.IsAuthenticated == true ? "authenticated" : "anonymous",
        agent);
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<DeviceHub>("/hubs/devices").RequireAuthorization();

// Serve static files from wwwroot in production
if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
    
    // Fallback to index.html for SPA routing
    app.MapFallbackToFile("index.html");
}

app.Run();
