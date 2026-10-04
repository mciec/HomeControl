using System.Text.Json;
using System.Text.Json.Serialization;

namespace LedStripeWithSensors.MqttManager;

/// <summary>
/// Kind of animation lifecycle event being reported on the entrance/motion topic.
/// </summary>
internal enum AnimationEventType
{
    Started,
    Stopped
}

/// <summary>
/// What triggered the animation: an explicit MQTT override command, or the motion sensors.
/// </summary>
internal enum AnimationSource
{
    Override,
    Motion
}

/// <summary>
/// Wire-level direction for the entrance/motion JSON payload. Distinct from
/// <see cref="Animations1d.Direction"/> (which has a NONE member and upper-case names used
/// for internal animation control) so the JSON only ever carries "Left" or "Right".
/// </summary>
internal enum AnimationDirection
{
    Left,
    Right
}

/// <summary>
/// Structured payload published on <see cref="EntranceMqttTopicsConfig.MotionDetectedTopic"/>
/// whenever an animation starts or stops, whether triggered by an override command or by
/// motion detection. Serialized as camelCase JSON with string enum values.
/// </summary>
internal sealed record AnimationEventMessage(
    AnimationEventType Event,
    AnimationDirection Direction,
    AnimationSource Source,
    string Animation,
    DateTime StartedAtUtc,
    int DurationMs)
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    public string ToJson() => JsonSerializer.Serialize(this, SerializerOptions);
}
