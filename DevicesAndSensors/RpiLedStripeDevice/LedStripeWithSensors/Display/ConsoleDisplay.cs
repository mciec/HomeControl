using Animations1d.Display;
using Iot.Device.Ws28xx;
using Microsoft.Extensions.Options;
using System.Device.Spi;

namespace LedStripeWithSensors.Display;

internal sealed class ConsoleDisplay : IDisplay
{
    public int Width { get; }
    public RGB[] Matrix { get; }

    public ConsoleDisplay(IOptions<NeopixelConfig> neopixelConfig)
    {
        if (neopixelConfig is null)
            throw new Exception("NeopixelConfig not available");

        Width = neopixelConfig.Value.Width;

        Matrix = new RGB[Width];

        Console.SetCursorPosition(0, 0);
        Console.WriteLine();
        Console.WriteLine();

    }

    public void Flush()
    {
        Console.SetCursorPosition(0, 0);
        for (int i = 0; i < Width; i++)
        {
            var colorIntensity = Math.Max(Math.Max(Matrix[i].R, Matrix[i].G), Matrix[i].B);
            switch (colorIntensity)
            {
                case < 50:
                    Console.BackgroundColor = ConsoleColor.Black; break;
                case < 100:
                    Console.BackgroundColor = ConsoleColor.DarkGray; break;
                case < 200:
                    Console.BackgroundColor = ConsoleColor.Gray; break;
                default:
                    Console.ForegroundColor = ConsoleColor.White; break;
            }
            Console.Write(" ");
        }
    }

    public void Reset()
    {
        Console.SetCursorPosition(0, 0);
        Console.BackgroundColor = ConsoleColor.Black;
        for (int i = 0; i < Width; i++)
        {
            Console.Write(" ");
        }
    }
}
