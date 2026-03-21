using Animations1d.Display;
using Iot.Device.Ws28xx;
using Microsoft.Extensions.Options;
using System.Device.Spi;

namespace LedStripeWithSensors.Display;

internal sealed class Neopixel : IDisplay
{
    private readonly Ws2812b _ws2812B = null!;
    public int Width { get; }
    public RGB[] Matrix { get; }

    public Neopixel(IOptions<NeopixelConfig> neopixelConfig)
    {
        if (neopixelConfig is null)
            throw new Exception("NeopixelConfig not available");

        Width = neopixelConfig.Value.Width;

        Matrix = new RGB[Width];

        SpiConnectionSettings settings = new(0, 0)
        {
            ClockFrequency = 2_400_000,
            Mode = SpiMode.Mode0,
            DataBitLength = 8
        };

        var spi = SpiDevice.Create(settings);

        _ws2812B = new Ws2812b(spi, Width);
    }

    public void Flush()
    {
        for (int i = 0; i < Width; i++)
        {
            _ws2812B.Image.SetPixel(i, 0, System.Drawing.Color.FromArgb((int)Matrix[i].R, (int)Matrix[i].G, (int)Matrix[i].B));
        }
        _ws2812B.Update();
    }

    public void Reset()
    {
        for (int i = 0; i < Width; i++)
        {
            _ws2812B.Image.SetPixel(i, 0, System.Drawing.Color.FromArgb(0, 0, 0));
        }
        _ws2812B.Update();
    }
}
