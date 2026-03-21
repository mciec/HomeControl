using LedStripeChristmasTree.MqttManager;
using Microsoft.Extensions.Options;
using LedStripeChristmasTree.Animations;

namespace LedStripeChristmasTree.AnimationManager;

internal enum AnimationState
{
    Stopped = 0,
    OverrideLeftRunning = 1,
    OverrideRightRunning = 2,
    MovementLeftRunning = 3,
    MovementRightRunning = 4,
}

internal sealed class AnimationManager
{
    private readonly bool _verbose = false;
    private readonly int _frameDurationMs;
    private readonly int _animationSwitchTimeSec;
    private readonly IOptions<AnimationManagerConfig> _animationManagerConfig;
    private readonly AnimationFactory _animationFactory;
    private readonly MqttClient _mqttClient;
    private Type _animationType = typeof(FlyingBallsAnimation);

    private AnimationState State { get; set; } = AnimationState.Stopped;
    private DateTime AnimationStart { get; set; } = DateTime.Now;

    public AnimationManager(IOptions<AnimationManagerConfig> animationManagerConfig, AnimationFactory animationFactory, MqttClient mqttClient)
    {
        _frameDurationMs = animationManagerConfig.Value.FrameDurationMs;
        _animationSwitchTimeSec = animationManagerConfig.Value.AnimationSwitchTimeSec * 1000;
        _animationFactory = animationFactory;
        _mqttClient = mqttClient;
    }

    public async Task Run(CancellationToken ct)
    {
        DateTime now = DateTime.Now;

        var animation = _animationFactory.GetAnimation(_animationType);

        _mqttClient.Connect(
            (Type animationType) => { },
            ct);

        while (!ct.IsCancellationRequested)
        {
            now = DateTime.Now;

            if (!animation.GetType().Equals(_animationType))
            {
                animation.Stop();
                animation.Dispose();
                animation = _animationFactory.GetAnimation(_animationType);
                animation.Start();
                AnimationStart = now; ;
            }

            var timeLeftMs = (int)(AnimationStart - now).TotalMilliseconds + _animationSwitchTimeSec;
            if (timeLeftMs > 0)
            {
                animation.NextFrame();
                await Task.Delay(Math.Min(timeLeftMs, _frameDurationMs));
                continue;
            }

            animation.Stop();
            State = AnimationState.Stopped;
        }
    }
}
