using Animations1d.Display;
using Microsoft.Extensions.Logging;

namespace Animations1d;

public class ExplosionsAnimation : AnimationBase
{

    private const int MaxAge = 60;
    private const int ActiveCount = 3;
    private const float ClusterSpeed = 0.2f;
    private const float SpawnJitter = 10f;
    private const float WaveArrivalFraction = 0.38f;

    private class Explosion
    {
        public float Center { get; set; }
        public int Age { get; set; }
        public int Radius { get; set; }
        public int MaxAge { get; set; }
        public bool IsAlive => Age < MaxAge;
    }

    private readonly List<Explosion> _explosions = new();
    private float _clusterCenter;

    public ExplosionsAnimation(IDisplay display, ILogger<AnimationBase> logger)
        : base(display, logger) { }

    public override void Dispose() { }

    protected override void GenerateNextFrame()
    {
        // Move cluster center at constant speed, wrapping around
        float speed = ClusterSpeed * (Direction == Direction.LEFT ? -1f : 1f);
        _clusterCenter += speed;
        if (_clusterCenter < 0) _clusterCenter += Display.Width;
        if (_clusterCenter >= Display.Width) _clusterCenter -= Display.Width;

        // On first frame: reset and pre-stagger explosions across the lifecycle
        if (FrameNumber == 1)
        {
            _explosions.Clear();
            _clusterCenter = Display.Width / 2f;
            for (int i = 0; i < ActiveCount; i++)
            {
                int r = RandomRadius();
                _explosions.Add(new Explosion
                {
                    Center = ClampedSpawnCenter(),
                    Age = i * (MaxAge / ActiveCount),
                    Radius = r,
                    MaxAge = RadiusToMaxAge(r)
                });
            }
        }

        // Age all, remove dead
        foreach (var exp in _explosions)
            exp.Age++;
        _explosions.RemoveAll(e => !e.IsAlive);

        // Refill to maintain exactly ActiveCount
        while (_explosions.Count < ActiveCount)
        {
            int r = RandomRadius();
            _explosions.Add(new Explosion { Center = ClampedSpawnCenter(), Age = 0, Radius = r, MaxAge = RadiusToMaxAge(r) });
        }

        // Render
        for (int i = 0; i < Display.Width; i++)
            Display.Matrix[i] = new RGB(0, 0, 0);

        foreach (var exp in _explosions)
            RenderExplosion(exp);

        Display.Flush();
    }

    private static int RandomRadius() => Random.Shared.Next(5, 10);

    // Smaller explosions burn faster: radius 5 → 30 frames, radius 9 → 60 frames
    private static int RadiusToMaxAge(int radius) => 30 + (radius - 5) * (MaxAge - 30) / (9 - 5);

    // Pick the candidate (out of several random tries) that is furthest from young explosions
    private float ClampedSpawnCenter()
    {
        const int candidates = 10;
        const int youngAge = MaxAge / 2;

        float best = _clusterCenter;
        float bestMinDist = -1f;

        for (int c = 0; c < candidates; c++)
        {
            float jitter = (Random.Shared.NextSingle() * 2f - 1f) * SpawnJitter;
            float candidate = Math.Clamp(_clusterCenter + jitter, 0f, Display.Width - 1f);

            float minDist = float.MaxValue;
            foreach (var exp in _explosions)
                if (exp.Age < youngAge)
                    minDist = Math.Min(minDist, MathF.Abs(candidate - exp.Center));

            float score = minDist == float.MaxValue ? float.MaxValue : minDist;
            if (score > bestMinDist)
            {
                bestMinDist = score;
                best = candidate;
            }
        }

        return best;
    }

    private void RenderExplosion(Explosion exp)
    {
        float globalProgress = (float)exp.Age / exp.MaxAge;

        int left = (int)(exp.Center - exp.Radius);
        int right = (int)(exp.Center + exp.Radius);

        for (int i = left; i <= right; i++)
        {
            if (i < 0 || i >= Display.Width) continue;

            float dist = MathF.Abs(i - exp.Center);
            float t = dist / exp.Radius;

            // Blast wave sweeps outward: center is hit first, edge last
            float arrivalProgress = t * WaveArrivalFraction;
            if (globalProgress < arrivalProgress) continue;

            float localProgress = (globalProgress - arrivalProgress) / (1f - arrivalProgress);

            // Quick ramp up to peak, then long fade
            float brightness = localProgress < 0.15f
                ? localProgress / 0.15f
                : 1f - (localProgress - 0.15f) / 0.85f;
            brightness = MathF.Max(0f, brightness);

            Display.Matrix[i] = AddRGB(Display.Matrix[i], ExplosionColor(t, brightness));
        }
    }

    // t=0: white  t=0.3: yellow  t=0.65: red  t=1: black
    private static RGB ExplosionColor(float t, float brightness)
    {
        RGB white  = new(255, 255, 255);
        RGB yellow = new(255, 200,   0);
        RGB red    = new(255,   0,   0);
        RGB black  = new(  0,   0,   0);

        RGB baseColor = t < 0.3f
            ? LerpRGB(white,  yellow, t / 0.3f)
            : t < 0.65f
                ? LerpRGB(yellow, red,   (t - 0.3f)  / 0.35f)
                : LerpRGB(red,    black, (t - 0.65f) / 0.35f);

        return new RGB(
            (byte)(baseColor.R * brightness),
            (byte)(baseColor.G * brightness),
            (byte)(baseColor.B * brightness));
    }

    private static RGB LerpRGB(RGB a, RGB b, float t) => new(
        (byte)(a.R + (b.R - a.R) * t),
        (byte)(a.G + (b.G - a.G) * t),
        (byte)(a.B + (b.B - a.B) * t));

    private static RGB AddRGB(RGB a, RGB b) => new(
        (byte)Math.Min(255, a.R + b.R),
        (byte)Math.Min(255, a.G + b.G),
        (byte)Math.Min(255, a.B + b.B));
}
