namespace LedStripeChristmasTree.Neopixel;

internal sealed class NeopixelConfig
{
    /// <summary>
    /// Not used for RPI Zero - always MOSI := GPIO10
    /// </summary>
    public int Pin { get; set; }
    public int Width { get; set; }
}
