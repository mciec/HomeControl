using Animations1d.Display;
using Microsoft.Extensions.Options;

namespace BlazorAnimationSimulator.Client.Display;

public class MemoryDisplay : IDisplay
{
    private readonly IOptions<DisplayConfig> _displayConfig;
    public RGB[] Matrix { get; init; }
    public int Width { get; init; }


    public MemoryDisplay(IOptions<DisplayConfig> displayConfig)
    {
        _displayConfig = displayConfig;
        Width = displayConfig.Value.Width;
        Matrix = new RGB[Width];
    }
    public void Flush()
    {
    }

    public void Reset()
    {
        for (int i = 0; i < Width; i++)
        {
            Matrix[i] = new RGB() { R = 0, G = 0, B = 0 };
        }
    }
}
