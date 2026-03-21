using BlazorAnimationSimulator.Client.Pages;
using BlazorAnimationSimulator.Components;
using Microsoft.Extensions.Options;
using Animations1d;
using BlazorAnimationSimulator.Client.Display;
using Animations1d.Display;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveWebAssemblyComponents();

builder.Services.AddOptions<DisplayConfig>().BindConfiguration("BrowserDivs");
builder.Services.AddOptions<AnimationsConfig>().BindConfiguration("Animations");
builder.Services.AddOptions<FlyingBallsAnimationConfig>().BindConfiguration("Animations:FlyingBallsAnimation");
builder.Services.AddScoped<AnimationFactory>();
builder.Services.AddAnimations();
builder.Services.AddTransient<IDisplay, MemoryDisplay>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
}

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(BlazorAnimationSimulator.Client._Imports).Assembly);

app.Run();
