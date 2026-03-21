using Iot.Device.Ws28xx;
using Microsoft.Extensions.Options;

namespace LedStripeChristmasTree.Animations;

internal class AnimationFactory
{
    private readonly IOptions<AnimationsConfig> _animationsConfig;
    private readonly Ws2812b _neopixel;

    public AnimationFactory(IOptions<AnimationsConfig> animationsConfig, Ws2812b neopixel)
    {
        _animationsConfig = animationsConfig;
        _neopixel = neopixel;
    }
    public IAnimation GetAnimation(Type type)
    {
        if (type == typeof(FlyingBallsAnimation))
        {
            return FlyingBallsAnimation.Create(_animationsConfig.Value.FlyingBallsAnimation, _neopixel);
        }
        throw new Exception($"Unknown IAnimation: {type.Name}");
    }
}
