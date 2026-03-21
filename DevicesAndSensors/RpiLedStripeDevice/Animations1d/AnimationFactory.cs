using Animations1d.Display;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Animations1d;

public class AnimationFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IOptions<AnimationsConfig> _animationsConfig;
    private readonly IDisplay _display;
    private readonly ILogger<AnimationFactory> _logger;
    private readonly IEnumerable<IAnimation> _animations;

    public AnimationFactory(
        IServiceProvider serviceProvider, 
        IOptions<AnimationsConfig> animationsConfig, 
        IDisplay display, 
        ILogger<AnimationFactory> logger,
        IEnumerable<IAnimation> animations)
    {
        _serviceProvider = serviceProvider;
        _animationsConfig = animationsConfig;
        _display = display;
        _logger = logger;
        _animations = animations;
    }

    public IAnimation GetAnimation(Type type)
    {
        var animation = _animations.FirstOrDefault(anim => anim.GetType() == type);
        if (animation == null)
            throw new Exception($"Unknow IAnimation: {type.Name}");

        return animation;
    }
}
