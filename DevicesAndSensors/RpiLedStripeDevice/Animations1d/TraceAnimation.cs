using Animations1d.Display;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using static Animations1d.TracedBall;

namespace Animations1d;

public sealed class TraceAnimation : AnimationBase
{
    private readonly int _tracedBallsCount;

    private static double oneDegree = Math.PI / 180.0;
    private static int[] SinLookup;
    private static byte[] SinSqrLookup;
    private static int[] CosLookup;
    private static byte[] CosSqrLookup;

    static TraceAnimation()
    {
        SinLookup = new int[360];
        SinSqrLookup = new byte[360];
        CosLookup = new int[360];
        CosSqrLookup = new byte[360];
        double degree = 0;
        for (int i = 0; i < SinLookup.Length; i++)
        {
            var sinus = Math.Sin(degree);
            SinLookup[i] = (int)(sinus * 127);
            SinSqrLookup[i] = (byte)(sinus * sinus * 255);
            CosLookup[i] = (int)(Math.Cos(degree) * 127);
            CosSqrLookup[i] = (byte)(255 - SinSqrLookup[i]);
            degree += oneDegree;
        }
    }
    private TracedBall[] TracedBalls { get; set; }

    public TraceAnimation(IOptions<FlyingBallsAnimationConfig> flyingBallsAnimationConfig, IDisplay display, ILogger<TraceAnimation> logger) : base(display, logger)
    {
        _tracedBallsCount = flyingBallsAnimationConfig.Value.MovingBallsCount;
        TracedBalls = new TracedBall[_tracedBallsCount];
        for (int i = 0; i < _tracedBallsCount; i++)
        {
            TracedBalls[i] = new(x: -1, v: 0, colorPalette: 0, viewPortSize: 0, dimmingPercent: 100, size: 1, (oldX, oldV, t) => (0, 0));
        }
    }

    public override void Dispose()
    {
        Console.WriteLine($"TraceAnimation disposed");
    }

    protected override void GenerateNextFrame()
    {
        MoveTracedBalls();
        Display.Flush();
    }

    private void MoveTracedBalls()
    {
        for (int i = 0; i < _tracedBallsCount; i++)
        {
            if (TracedBalls[i].IsBlank)
            {
                switch (i)
                {
                    case 0:
                        TracedBalls[i] = new TracedBall(
                            x: Display.Width * 0.1,
                            v: 0,
                            colorPalette: 1,
                            viewPortSize: Display.Width,
                            dimmingPercent: 90,
                            size: 15,
                            SpringFollowingSinus
                            );
                        break;
                    case 1:
                        TracedBalls[i] = new TracedBall(
                            x: Display.Width * 0.9,
                            v: 0,
                            colorPalette: 2,
                            viewPortSize: Display.Width,
                            dimmingPercent: 90,
                            size: 15,
                            SpringFollowingSinus
                            );
                        break;
                    default:
                        var colorPalette = 0;
                        TracedBalls[i] = new TracedBall(
                            x: Direction == Direction.LEFT ? 0 : Display.Width,
                            v: Direction == Direction.LEFT ? 5 : -5,
                            colorPalette: colorPalette,
                            viewPortSize: Display.Width,
                            dimmingPercent: 95,
                            size: 7,
                            SlowingDownExp
                            );
                        break;
                }
            }
            TracedBalls[i].MoveBall();
        }

        for (int x = 0; x < Display.Width; x++)
        {
            byte maxR = 0, maxG = 0, maxB = 0;
            foreach (var tracedBall in TracedBalls.Where(tb => !tb.IsBlank))
            {
                maxR = Math.Max(maxR, tracedBall.ColorView[x].R);
                maxG = Math.Max(maxG, tracedBall.ColorView[x].G);
                maxB = Math.Max(maxB, tracedBall.ColorView[x].B);
            }
            Display.Matrix[x] = new RGB(maxR, maxG, maxB);
        }
    }
    private int Sinus(int angle) => angle < 0 ? -SinLookup[-angle % 360] : SinLookup[angle % 360];
    private int SinusSqr(int angle) => SinSqrLookup[Math.Abs(angle) % 360];

    private (double newX, double newV) SpringFollowingSinus(double oldX, double oldV, int t)
    {
        var sinX = Display.Width / 2;  // + (SinLookup[(t * 3) % 360] / 3);
        var f = sinX - oldX;
        var v = oldV + f / 3000;
        var x = oldX + v;
        return (x, v);
    }

    private (double newX, double newV) SlowingDownExp(double oldX, double oldV, int t)
    {
        var x = oldX + oldV;
        var v = oldV * 0.93;
        return (x, v);
    }
}

internal class TracedBall
{
    private int _t = 0;
    private const int dimmingPercent = 90;
    private const int maxIntensity_16 = 0xFFFFFF;
    private byte[] _intensityView;

    public RGB[] ColorView { get; private set; }
    public bool IsBlank { get; private set; } = true;

    private static double oneDegree = Math.PI / 180.0;
    private static byte[] SinLookup;
    private static byte[] SinSqrLookup;
    private static byte[] CosLookup;
    private static byte[] CosSqrLookup;
    private static (byte, byte, byte)[][] ColourLookup;
    private readonly int Size = 5;
    public double X { get; set; }
    public double V { get; set; }
    public int ColorPalette { get; set; }
    public int ViewPortSize { get; }
    public int DimmingPercent { get; }
    public int T { get; private set; } = 0;
    public int Dir => V > 0 ? 1 : -1;
    public delegate (double newX, double newV) KinematicsFormula(double oldX, double oldV, int t);
    public readonly KinematicsFormula _kinematicsFormula;

    public TracedBall(double x, double v, int colorPalette, int viewPortSize, int dimmingPercent, int size, KinematicsFormula kiematicsFormula)
    {
        X = x;
        V = v;
        ColorPalette = colorPalette;
        ViewPortSize = viewPortSize;
        DimmingPercent = dimmingPercent;
        Size = size;
        _kinematicsFormula = kiematicsFormula;
        _intensityView = new byte[viewPortSize];
    }

    public bool MoveBall()
    {
        var (x, v) = _kinematicsFormula(X, V, ++T);
        return MoveBall(x, v);
    }
    public bool MoveBall(double newX, double newV)
    {
        const double maxIntensity = 255.0;
        double distFactor = Size * 0.3;
        IsBlank = DimIntensityView(DimmingPercent);
        var oldX = X;

        var intensityAtOldX = (maxIntensity * dimmingPercent) / 100;
        var intensityAtNewX = maxIntensity;
        var step = (intensityAtNewX - intensityAtOldX) / (newX - oldX);

        for (int i = 0; i < _intensityView.Length; i++)
        {
            var dist2 = (i - newX) * (i - newX);
            var intensityFromGlow = dist2 == 0 ? maxIntensity : Math.Min(distFactor * maxIntensity / dist2, 255);
            double intensityFromTrace;

            //trace intensity calculation
            if (oldX <= newX)
            {
                if (i < oldX || i > newX)
                    intensityFromTrace = 0;
                else
                    intensityFromTrace = intensityAtOldX + (i - oldX) * step;
            }
            else
            {
                if (i < newX || i > oldX)
                    intensityFromTrace = 0;
                else
                    intensityFromTrace = intensityAtOldX + (i - oldX) * step;
            }

            _intensityView[i] = Math.Max((byte)Math.Max(intensityFromGlow, intensityFromTrace), _intensityView[i]);

            if (newX >= 0 && newX < _intensityView.Length)
            {
                IsBlank = false;
            }
        }

        X = newX;
        V = newV;
        FlushColorView(ColorPalette);
        return IsBlank;
    }


    private bool DimIntensityView(int targetPercent)
    {
        bool isBlank = true;
        int ratio_16 = (targetPercent << 16) / 100;
        byte targetVal;

        for (int i = 0; i < _intensityView.Length; i++)
        {
            int intensityViewAtI = _intensityView[i];

            int intensity_16 = intensityViewAtI * ratio_16;
            targetVal = (byte)(intensity_16 >> 16);
            _intensityView[i] = targetVal;
            if (targetVal > 0)
                isBlank = false;
        }

        return isBlank;
    }

    private void FlushColorView(int colorPallette)
    {
        ColorView = _intensityView.Select(intensity => new RGB(
            ColourLookup[colorPallette][intensity].Item1,
            ColourLookup[colorPallette][intensity].Item2,
            ColourLookup[colorPallette][intensity].Item3)).ToArray();
    }

    static TracedBall()
    {
        SinLookup = new byte[360];
        SinSqrLookup = new byte[360];
        CosLookup = new byte[360];
        CosSqrLookup = new byte[360];
        double degree = 0;
        for (int i = 0; i < SinLookup.Length; i++)
        {
            var sinus = Math.Sin(degree);
            SinLookup[i] = (byte)(sinus * 127);
            SinSqrLookup[i] = (byte)(sinus * sinus * 255);
            CosLookup[i] = (byte)(Math.Cos(degree) * 127);
            CosSqrLookup[i] = (byte)(255 - SinSqrLookup[i]);
            degree += oneDegree;
        }

        ColourLookup = new (byte, byte, byte)[3][];
        for (int i = 0; i < 3; i++)
            ColourLookup[i] = new (byte, byte, byte)[256];

        for (int i = 0; i < 256; i++)
        {
            ColourLookup[0][i] = (
                i < 70 ? (byte)(i * (256.0 / 70)) : i < 200 ? (byte)255 : (byte)255,    //(byte)(255 - (i - 200)),
                i < 70 ? (byte)0 : i < 200 ? (byte)((i - 70.0) * (256.0 / (200.0 - 70.0))) : (byte)255, //(byte)(255 - (i - 200)),
                i < 200 ? (byte)0 : (byte)((i - 200) * (255.0 / 55.0))
                //i < 100 ? (byte)(i * (255.0 / 100.0)) : i < 155 ? (byte)(255.0 - (i - 100.0) * 2.0) : i < 210 ? (byte)(145.0 + (i - 155.0) * 2.0) : (byte)255,
                //i < 100 ? (byte)0 : i < 210 ? (byte)((i - 100.0) * (255.0 / 110.0)) : (byte)255,
                //i < 230 ? (byte)0 : (byte)((i - 230.0) * (255.0 / 25.0))
                );

            ColourLookup[1][i] = (
                    i < 200 ? (byte)0 : (byte)((i - 200) * (255.0 / 55.0)),
                    i < 70 ? (byte)0 : i < 200 ? (byte)((i - 70.0) * (256.0 / (200.0 - 70.0))) : (byte)255, //(byte)(255 - (i - 200)),
                    i < 70 ? (byte)(i * (256.0 / 70)) : i < 200 ? (byte)255 : (byte)255    //(byte)(255 - (i - 200)),
                    );

            ColourLookup[2][i] = (
                i < 200 ? (byte)0 : (byte)((i - 200) * (255.0 / 55.0)),
                i < 70 ? (byte)(i * (256.0 / 70)) : i < 200 ? (byte)255 : (byte)255,    //(byte)(255 - (i - 200)),
                i < 70 ? (byte)0 : i < 200 ? (byte)((i - 70.0) * (256.0 / (200.0 - 70.0))) : (byte)255 //(byte)(255 - (i - 200)),
                );
        }
    }

    //public bool MoveBall(int newX, int newV_16)
    //{
    //    IsBlank = DimIntensityView(DimmingPercent);
    //    var oldX = X;
    //    var intensityAtOldX_16 = (maxIntensity_16 * dimmingPercent) / 100;
    //    var intensityAtNewX_16 = maxIntensity_16;

    //    if (newX >= 0 && newX < _intensityView.Length)
    //    {
    //        _intensityView[newX] = 255;
    //        IsBlank = false;
    //    }

    //    if (newX != X)
    //    {
    //        var step_16 = Math.Abs((intensityAtNewX_16 - intensityAtOldX_16) / (newX - X));

    //        oldX = X < 0 ? 0 : oldX >= _intensityView.Length ? _intensityView.Length - 1 : oldX;

    //        intensityAtOldX_16 = (oldX - X) * step_16 + intensityAtOldX_16;

    //        if (newX <= X)
    //        {
    //            var currVal_16 = intensityAtOldX_16;
    //            for (int i = X - 1; i > newX; i--)
    //            {
    //                currVal_16 += step_16;
    //                if (i < 0 || i >= _intensityView.Length)
    //                    continue;
    //                _intensityView[i] = (byte)(currVal_16 >> 16);
    //                IsBlank &= _intensityView[i] == 0;
    //            }
    //        }
    //        else
    //        {
    //            var currVal_16 = intensityAtOldX_16;
    //            for (int i = X + 1; i < newX; i++)
    //            {
    //                currVal_16 += step_16;
    //                if (i < 0 || i >= _intensityView.Length)
    //                    continue;
    //                _intensityView[i] = (byte)(currVal_16 >> 16);
    //                IsBlank &= _intensityView[i] == 0;
    //            }
    //        }
    //    }

    //    X = newX;
    //    V = newV_16;
    //    FlushColorView(ColorPalette);
    //    return IsBlank;
    //}


}
