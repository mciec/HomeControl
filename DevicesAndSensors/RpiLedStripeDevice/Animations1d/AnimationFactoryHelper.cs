using Microsoft.Extensions.DependencyInjection;

namespace Animations1d;

public static class AnimationFactoryHelper
{
    public static IServiceCollection AddAnimations(this IServiceCollection services)
    {
        services.AddSingleton<IAnimation, FlyingBallsAnimation>();
        services.AddSingleton<IAnimation, TraceAnimation>();
        services.AddSingleton<IAnimation, WavesAnimation>();
        services.AddSingleton<IAnimation, FireballTraceAnimation>();
        services.AddSingleton<IAnimation, ExplosionsAnimation>();
        return services;
    }
}
