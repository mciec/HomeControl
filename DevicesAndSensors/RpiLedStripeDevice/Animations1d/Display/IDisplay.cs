namespace Animations1d.Display;

public struct RGB
{
    public byte R;
    public byte G;
    public byte B;
    public RGB(byte r, byte g, byte b)
    {
        R = r;
        G = g;
        B = b;
    }
}
public interface IDisplay
{
    RGB[] Matrix { get; }
    public int Width { get; }
    public void Flush();
    public void Reset();
}
