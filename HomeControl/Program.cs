using Config;
using MqttBroker.Installers;
using NLog.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

IConfiguration config = ConfigManager.GetConfig();

var installers = System.Reflection.Assembly.GetExecutingAssembly().ExportedTypes
    .Where(t => typeof(IInstaller).IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract)
    .Select(Activator.CreateInstance).Cast<IInstaller>().ToList();
installers.ForEach(i => i.InstallService(builder.Services, config));

builder.WebHost.ConfigureLogging((webHostBuilderContext, loggingBuilder) =>
    {
        loggingBuilder.AddNLog();
    });

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
