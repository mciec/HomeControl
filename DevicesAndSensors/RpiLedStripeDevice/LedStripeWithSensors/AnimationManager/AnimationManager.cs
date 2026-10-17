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
    private const string MessageOn = "ON";
    private const string MessageOff = "OFF";
    private static readonly TimeSpan MotionTriggersStateHeartbeat = TimeSpan.FromSeconds(30);
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

    // When false, the motion sensors are ignored and animations only run via override.
    // Persisted so the setting survives a restart of the device.
    private volatile bool _motionTriggersEnabled = true;
    private readonly string _motionTriggersStatePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LedStripeWithSensors", "motion-triggers.txt");

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
                if (!_motionTriggersEnabled)
                {
                    _logger.LogInformation("Motion detected: {direction}, ignored (motion triggers disabled)", MessageLeft);
                    return;
                }
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
                if (!_motionTriggersEnabled)
                {
                    _logger.LogInformation("Motion detected: {direction}, ignored (motion triggers disabled)", MessageRight);
                    return;
                }
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

        _motionTriggersEnabled = LoadMotionTriggersEnabled();
        _logger.LogInformation("Motion triggers: {state}", _motionTriggersEnabled ? MessageOn : MessageOff);

        _mqttClient.MessageReceived += (sender, args) =>
        {
            if (args.Topic == _topics.MotionTriggersSetTopic)
            {
                HandleMotionTriggersCommand(args.Payload);
                return;
            }

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

        _mqttClient.Connect(new[] { _topics.OverrideTopic, _topics.MotionTriggersSetTopic }, ct);

        var nextStatePublish = DateTime.MinValue;

        while (!ct.IsCancellationRequested)
        {
            now = DateTime.Now;

            // Republished periodically (not only on change) so a restarted backend/broker, which lose
            // the retained message, learn the current state again.
            if (now >= nextStatePublish)
            {
                PublishMotionTriggersState();
                nextStatePublish = now + MotionTriggersStateHeartbeat;
            }

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

            if (!_motionTriggersEnabled
                && (State == AnimationState.MovementLeftRunning || State == AnimationState.MovementRightRunning))
            {
                animation.Stop();
                PublishAnimationEvent(AnimationEventType.Stopped, AnimationDirectionFromState, AnimationSource.Motion, animation.Name);
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

    private void HandleMotionTriggersCommand(string payload)
    {
        switch (payload.Trim().ToUpperInvariant())
        {
            case MessageOn:
                _motionTriggersEnabled = true;
                break;
            case MessageOff:
                _motionTriggersEnabled = false;
                MovementLeft = false;
                MovementRight = false;
                break;
            default:
                _logger.LogWarning("Ignoring unrecognized motion triggers command '{payload}'", payload);
                return;
        }

        _logger.LogInformation("Motion triggers set to {state}", _motionTriggersEnabled ? MessageOn : MessageOff);
        SaveMotionTriggersEnabled(_motionTriggersEnabled);
        PublishMotionTriggersState();
    }

    private bool LoadMotionTriggersEnabled()
    {
        try
        {
            return !File.Exists(_motionTriggersStatePath)
                || !string.Equals(File.ReadAllText(_motionTriggersStatePath).Trim(), MessageOff, StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not read {path}; motion triggers default to enabled", _motionTriggersStatePath);
            return true;
        }
    }

    private void SaveMotionTriggersEnabled(bool enabled)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_motionTriggersStatePath)!);
            File.WriteAllText(_motionTriggersStatePath, enabled ? MessageOn : MessageOff);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not persist motion triggers state to {path}", _motionTriggersStatePath);
        }
    }

    private void PublishMotionTriggersState() =>
        _mqttClient.Publish(_topics.MotionTriggersStateTopic, _motionTriggersEnabled ? MessageOn : MessageOff, retain: true);

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
