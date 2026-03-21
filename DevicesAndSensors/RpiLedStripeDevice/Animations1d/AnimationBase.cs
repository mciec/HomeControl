using Animations1d.Display;
using Microsoft.Extensions.Logging;

namespace Animations1d;

public abstract class AnimationBase : IAnimation
{
    private readonly bool _verbose = true;
    private ILogger<AnimationBase> _logger;
    protected int FrameNumber;
    protected Direction Direction = Direction.NONE;
    public IDisplay Display { get; private set; }

    protected AnimationBase(IDisplay display, ILogger<AnimationBase> logger)
    {
        Display = display;
        _logger = logger;
    }

    public void Stop()
    {
        _logger.LogInformation("STOP: animation {animationType} from {direction}", GetType().Name, Direction);
        Direction = Direction.NONE;
        FrameNumber = 0;
        Display.Reset();
        if (_verbose) PrintStatus();
    }

    public void Start(Direction direction)
    {
        _logger.LogInformation("START: animation {animationType} from {direction}", GetType().Name, direction);
        Direction = direction;
        FrameNumber = 0;
        if (_verbose) PrintStatus();
    }

    public void NextFrame()
    {
        FrameNumber++;
        GenerateNextFrame();
        if (_verbose) PrintStatus();
    }

    protected abstract void GenerateNextFrame();

    public abstract void Dispose();

    protected virtual void PrintStatus()
    {
        //Console.SetCursorPosition(0, 5);
        Console.WriteLine($"{DateTime.Now:yyyyMMdd HH:mm:ss}: [{GetType().Name}]: Dir: {Direction} Frame: {FrameNumber}");
    }
}
