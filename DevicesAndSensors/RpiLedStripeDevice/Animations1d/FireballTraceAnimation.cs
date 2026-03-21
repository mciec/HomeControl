using Animations1d.Display;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;

namespace Animations1d;

public sealed class FireballTraceAnimation : AnimationBase
{
    private readonly ILogger<FireballTraceAnimation> _logger;
    private readonly int _fireballCount;
    private readonly int _traceLength;
    private readonly Random _rand = new();
    private Fireball[] _fireballs;
    private RGB[] _palette;

    public FireballTraceAnimation(IOptions<FlyingBallsAnimationConfig> config, IDisplay display, ILogger<FireballTraceAnimation> logger)
        : base(display, logger)
    {
        _logger = logger;
        _fireballCount = Math.Max(1, config.Value.MovingBallsCount);
        _traceLength = Math.Max(5, config.Value.StaticBallsCount * 5);
        InitPalette();
        InitFireballs();
    }

    private void InitPalette()
    {
        // Rainbow palette
        _palette = new RGB[] {
            new(255, 0, 0),   // Red
            new(255, 128, 0), // Orange
            new(255, 255, 0), // Yellow
            new(0, 255, 0),   // Green
            new(0, 255, 255), // Cyan
            new(0, 0, 255),   // Blue
            new(128, 0, 255), // Violet
            new(255, 0, 255)  // Magenta
        };
    }

    private void InitFireballs()
    {
        _fireballs = new Fireball[_fireballCount];
        for (int i = 0; i < _fireballCount; i++)
        {
            int start = Direction == Direction.LEFT ? Display.Width - 1 : 0;
            _fireballs[i] = new Fireball
            {
                Position = start - i * (_traceLength + 2),
                ColorIndex = i % _palette.Length,
                Speed = 1 + _rand.Next(2),
            };
        }
    }

    public override void Dispose()
    {
        Console.WriteLine("FireballTraceAnimation disposed");
    }

    protected override void GenerateNextFrame()
    {
        // Fade all pixels
        for (int i = 0; i < Display.Width; i++)
        {
            var px = Display.Matrix[i];
            Display.Matrix[i] = new RGB((byte)(px.R * 0.7), (byte)(px.G * 0.7), (byte)(px.B * 0.7));
        }

        // Move fireballs
        for (int i = 0; i < _fireballs.Length; i++)
        {
            var fb = _fireballs[i];
            int prevPos = fb.Position;
            fb.Position += Direction == Direction.LEFT ? -fb.Speed : fb.Speed;
            if (fb.Position < 0 || fb.Position >= Display.Width)
            {
                // Reset fireball
                fb.Position = Direction == Direction.LEFT ? Display.Width - 1 : 0;
                fb.ColorIndex = (fb.ColorIndex + 1) % _palette.Length;
                fb.Speed = 1 + _rand.Next(2);
            }
            // Draw trace
            for (int t = 0; t < _traceLength; t++)
            {
                int tracePos = fb.Position + (Direction == Direction.LEFT ? t : -t);
                if (tracePos >= 0 && tracePos < Display.Width)
                {
                    var color = _palette[fb.ColorIndex];
                    byte fade = (byte)(255 * (1.0 - t / (double)_traceLength));
                    Display.Matrix[tracePos] = new RGB(
                        (byte)(color.R * fade / 255),
                        (byte)(color.G * fade / 255),
                        (byte)(color.B * fade / 255));
                }
            }
        }
        Display.Flush();
    }

    public new void Start(Direction direction)
    {
        base.Start(direction);
        InitFireballs();
    }

    private class Fireball
    {
        public int Position;
        public int ColorIndex;
        public int Speed;
    }
}
