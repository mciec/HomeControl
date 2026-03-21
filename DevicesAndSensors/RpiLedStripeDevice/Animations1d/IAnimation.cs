using Animations1d.Display;

namespace Animations1d;

public enum Direction
{
    NONE = 0,
    LEFT = 1,
    RIGHT = 2
}

public interface IAnimation : IDisposable
{
    void NextFrame();
    void Stop();
    void Start(Direction direction);
    IDisplay Display { get; }
}
