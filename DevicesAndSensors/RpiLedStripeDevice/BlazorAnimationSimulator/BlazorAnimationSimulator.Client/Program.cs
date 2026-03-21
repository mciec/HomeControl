using Animations1d;
using Animations1d.Display;
using BlazorAnimationSimulator.Client.Display;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.Options;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.Services.AddOptions<DisplayConfig>().BindConfiguration("BrowserDivs");
builder.Services.AddOptions<AnimationsConfig>().BindConfiguration("Animations");
builder.Services.AddOptions<FlyingBallsAnimationConfig>().BindConfiguration("Animations:FlyingBallsAnimation");

builder.Services.AddScoped<AnimationFactory>();
builder.Services.AddAnimations();
builder.Services.AddTransient<IDisplay, MemoryDisplay>();

var webAssemblyHost = builder.Build();

await webAssemblyHost.RunAsync();
