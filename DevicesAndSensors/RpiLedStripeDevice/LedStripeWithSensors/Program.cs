using Animations1d;
using Animations1d.Display;
using LedStripeWithSensors.AnimationManager;
using LedStripeWithSensors.Display;
using LedStripeWithSensors.MotionSensor;
using LedStripeWithSensors.MqttManager;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NLog.Extensions.Logging;
using System.Reflection;

HostApplicationBuilder builder = Host.CreateApplicationBuilder(args);

builder.Configuration.Sources.Clear();
builder.Configuration
    .AddJsonFile("appSettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appSettings.{builder.Environment.EnvironmentName}.json", true, true)
    .AddUserSecrets(Assembly.GetExecutingAssembly())
    .AddEnvironmentVariables(src =>
    {
        src.Prefix = "DOTNET_LEDSTRIPEWITHSENSORS_";
    });

var mqttPaswword = builder.Configuration["MqttConfig:Password"];
builder.Services.AddOptions<MqttClientConfig>().BindConfiguration("MqttConfig")
    .PostConfigure(config => { config.Password = mqttPaswword!; });
builder.Services.AddOptions<MotionSensorsConfig>().BindConfiguration("MotionSensorsConfig");

builder.Services.AddOptions<AnimationsConfig>().BindConfiguration("Animations");
builder.Services.AddOptions<FlyingBallsAnimationConfig>().BindConfiguration("Animations:FlyingBallsAnimation");

builder.Services.AddOptions<NeopixelConfig>().BindConfiguration("Neopixel");
builder.Services.AddOptions<AnimationManagerConfig>().BindConfiguration("Manager");

builder.Services.AddScoped<AnimationFactory>();
builder.Services.AddAnimations();

builder.Services.AddSingleton<MqttClient>();
builder.Services.AddSingleton<AnimationManager>();
builder.Services.AddSingleton<ChannelManagerWithRecovery>();

builder.Services.AddSingleton<IDisplay, Neopixel>();
//builder.Services.AddSingleton<IDisplay, ConsoleDisplay>();

builder.Services.AddLogging(loggingBuilder =>
    {
        loggingBuilder.ClearProviders();
        loggingBuilder.SetMinimumLevel(LogLevel.Trace);
        loggingBuilder.AddNLog(builder.Configuration);
    });

using IHost host = builder.Build();

CancellationToken ct = new();

var animationManager = host.Services.GetRequiredService<AnimationManager>();

_ = Task.Run(() => animationManager.Run(ct));

await host.RunAsync();