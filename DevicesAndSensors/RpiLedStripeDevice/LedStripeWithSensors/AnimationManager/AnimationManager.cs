using MqttManager;
using LedStripeWithSensors.MqttManager;
using Microsoft.Extensions.Options;
using LedStripeWithSensors.MotionSensor;
using Animations1d;
using Microsoft.Extensions.Logging;

namespace LedStripeWithSensors.AnimationManager;

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
    private static List<TimeOnly> SunriseByMonth = new() {
        TimeOnly.Parse("07:36"), TimeOnly.Parse("06:50"), TimeOnly.Parse("05:47"), TimeOnly.Parse("05:35"), TimeOnly.Parse("04:38"), TimeOnly.Parse("04:11"),
        TimeOnly.Parse("04:31"), TimeOnly.Parse("05:18"), TimeOnly.Parse("06:09"), TimeOnly.Parse("07:00"), TimeOnly.Parse("06:55"), TimeOnly.Parse("07:37")};

    private static List<TimeOnly> SunsetByMonth = new() {
        TimeOnly.Parse("15:54"), TimeOnly.Parse("16:49"), TimeOnly.Parse("17:42"), TimeOnly.Parse("19:36"), TimeOnly.Parse("20:26"), TimeOnly.Parse("21:01"),
        TimeOnly.Parse("20:52"), TimeOnly.Parse("20:02"), TimeOnly.Parse("18:52"), TimeOnly.Parse("17:43"), TimeOnly.Parse("15:45"), TimeOnly.Parse("15:25") };

    private const string MessageLeft = "LEFT";
    private const string MessageRight = "RIGHT";
    private readonly bool _verbose = false;
    private readonly int _frameDurationMs;
    private readonly int _switchOffDelayMs;
    private readonly bool _dontRunAtDaylight;
    private readonly int _leftMotionDetectorPin;
    private readonly int _rightMotionDetectorPin;
    private readonly AnimationFactory _animationFactory;
    private readonly MqttClient _mqttClient;
    private readonly EntranceMqttTopicsConfig _topics;
    private readonly ILogger<AnimationManager> _logger;

    private bool MovementLeft { get; set; } = false;
    private bool MovementRight { get; set; } = false;
    private bool OverrideLeft { get; set; } = false;
    private bool OverrideRight { get; set; } = false;

    private AnimationState State { get; set; } = AnimationState.Stopped;
    private DateTime AnimationStart { get; set; } = DateTime.Now;

    public AnimationManager(IOptions<MotionSensorsConfig> motionSensorsConfig,
        IOptions<AnimationManagerConfig> animationManagerConfig,
        AnimationFactory animationFactory,
        MqttClient mqttClient,
        IOptions<EntranceMqttTopicsConfig> entranceMqttTopicsConfig,
        ILogger<AnimationManager> logger)
    {
        _leftMotionDetectorPin = motionSensorsConfig.Value.LeftMotionDetectorPin;
        _rightMotionDetectorPin = motionSensorsConfig.Value.RightMotionDetectorPin;
        _frameDurationMs = animationManagerConfig.Value.FrameDurationMs;
        _switchOffDelayMs = animationManagerConfig.Value.SwitchOffDelaySec * 1000;
        _dontRunAtDaylight = animationManagerConfig.Value.DontRunAtDaylight;
        _animationFactory = animationFactory;
        _mqttClient = mqttClient;
        _topics = entranceMqttTopicsConfig.Value;
        _logger = logger;
    }

    public async Task Run(CancellationToken ct)
    {
        DateTime now = DateTime.Now;

        _logger.LogTrace("Started at {startTime}", now);


        using var motionDetectorLeft = MotionSensor.MotionSensor.CreateSensor(_leftMotionDetectorPin,
            () =>
            {
                if (IgnoreDetectedMovement())
                {
                    _logger.LogInformation("Motion detected: {direction}, but it's daylight at {time}", MessageLeft, DateTime.Now.ToShortTimeString());
                    return;
                }
                MovementLeft = true;
                _logger.LogInformation("Motion detected: {direction}", MessageLeft);
            },
            () =>
            {
                MovementLeft = false;
                _logger.LogInformation("Motion stopped: {direction}", MessageLeft);
            });

        try
        {
            motionDetectorLeft.Run(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{direction} motion detector disabled", MessageLeft);
        }

        using var motionDetectorRight = MotionSensor.MotionSensor.CreateSensor(_rightMotionDetectorPin,
            () =>
            {
                if (IgnoreDetectedMovement())
                {
                    _logger.LogInformation("Motion detected: {direction}, ignored at {time}", MessageRight, DateTime.Now.ToShortTimeString());
                    return;
                }
                MovementRight = true;
                _logger.LogInformation("Motion detected: {direction}", MessageRight);
            },
            () =>
            {
                MovementRight = false;
                _logger.LogInformation("Motion stopped: {direction}", MessageRight);
            });
        try
        {
            motionDetectorRight.Run(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{direction} motion detector disabled", MessageRight);
        }

        var animation = _animationFactory.GetRandomAnimation();

        _mqttClient.MessageReceived += (sender, args) =>
        {
            if (args.Topic != _topics.OverrideTopic)
                return;

            switch (args.Payload.ToUpper())
            {
                case MessageLeft:
                    OverrideLeft = true;
                    OverrideRight = false;
                    _logger.LogInformation("{MessageLeft} OVERRIDE", MessageLeft);
                    break;
                case MessageRight:
                    OverrideRight = true;
                    OverrideLeft = false;
                    _logger.LogInformation("{MessageRight} OVERRIDE", MessageRight);
                    break;
            }
        };

        _mqttClient.Connect(new[] { _topics.OverrideTopic }, ct);

        while (!ct.IsCancellationRequested)
        {
            now = DateTime.Now;

            if (OverrideLeft)
            {
                animation = _animationFactory.GetRandomAnimation();
                animation.Start(Direction.LEFT);
                State = AnimationState.OverrideLeftRunning;
                AnimationStart = now;
                OverrideLeft = false;
                PublishAnimationEvent(AnimationEventType.Started, AnimationDirection.Left, AnimationSource.Override, animation.Name);
            }
            else
            if (OverrideRight)
            {
                animation = _animationFactory.GetRandomAnimation();
                animation.Start(Direction.RIGHT);
                State = AnimationState.OverrideRightRunning;
                AnimationStart = now;
                OverrideRight = false;
                PublishAnimationEvent(AnimationEventType.Started, AnimationDirection.Right, AnimationSource.Override, animation.Name);
            }

            if (State == AnimationState.OverrideLeftRunning || State == AnimationState.OverrideRightRunning)
            {
                var timeLeftMs = (int)(AnimationStart - now).TotalMilliseconds + _switchOffDelayMs;
                if (timeLeftMs > 0)
                {
                    animation.NextFrame();
                    await Task.Delay(Math.Min(timeLeftMs, _frameDurationMs));
                    continue;
                }
                animation.Stop();
                PublishAnimationEvent(AnimationEventType.Stopped, AnimationDirectionFromState, AnimationSource.Override, animation.Name);
                State = AnimationState.Stopped;
            }

            if ((State == AnimationState.MovementLeftRunning && MovementLeft) || (State == AnimationState.MovementRightRunning && MovementRight))
            {
                AnimationStart = now;
            }

            if (State == AnimationState.MovementLeftRunning || State == AnimationState.MovementRightRunning)
            {
                var timeLeftMs = (int)(AnimationStart - now).TotalMilliseconds + _switchOffDelayMs;
                if (timeLeftMs > 0)
                {
                    animation.NextFrame();
                    await Task.Delay(Math.Min(timeLeftMs, _frameDurationMs));
                    continue;
                }
                animation.Stop();
                PublishAnimationEvent(AnimationEventType.Stopped, AnimationDirectionFromState, AnimationSource.Motion, animation.Name);
                State = AnimationState.Stopped;
            }

            if (MovementLeft)
            {
                animation = _animationFactory.GetRandomAnimation();
                animation.Start(Direction.LEFT);
                State = AnimationState.MovementLeftRunning;
                AnimationStart = now;
                PublishAnimationEvent(AnimationEventType.Started, AnimationDirection.Left, AnimationSource.Motion, animation.Name);
            }
            else
            if (MovementRight)
            {
                animation = _animationFactory.GetRandomAnimation();
                animation.Start(Direction.RIGHT);
                State = AnimationState.MovementRightRunning;
                AnimationStart = now;
                PublishAnimationEvent(AnimationEventType.Started, AnimationDirection.Right, AnimationSource.Motion, animation.Name);
            }
        }
    }

    private static bool IsDayLight(DateTime dateTime)
    {
        var month = dateTime.Month;
        var sunrise = SunriseByMonth[month - 1].ToTimeSpan();
        var sunset = SunsetByMonth[month - 1].ToTimeSpan();
        return dateTime.TimeOfDay >= sunrise && dateTime.TimeOfDay <= sunset;
    }

    private bool IgnoreDetectedMovement()
    {
        if (!_dontRunAtDaylight)
            return false;

        if (IsDayLight(DateTime.Now))
            return true;

        return false;
    }

    private AnimationDirection AnimationDirectionFromState => State switch
    {
        AnimationState.OverrideLeftRunning => AnimationDirection.Left,
        AnimationState.OverrideRightRunning => AnimationDirection.Right,
        AnimationState.MovementLeftRunning => AnimationDirection.Left,
        AnimationState.MovementRightRunning => AnimationDirection.Right,
        _ => AnimationDirection.Left
    };

    private void PublishAnimationEvent(AnimationEventType eventType, AnimationDirection direction, AnimationSource source, string animationName)
    {
        var message = new AnimationEventMessage(
            eventType,
            direction,
            source,
            animationName,
            AnimationStart.ToUniversalTime(),
            _switchOffDelayMs);

        _mqttClient.Publish(_topics.MotionDetectedTopic, message.ToJson());
    }
}
