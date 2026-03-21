using System.Device.Gpio;

namespace LedStripeWithSensors.MotionSensor;

internal sealed class MotionSensor : IDisposable
{

    private readonly int _gpio;
    private readonly PinChangeEventHandler _onMotionOn;
    private readonly PinChangeEventHandler _onMotionOff;
    private GpioController _gpioController = null;
    private Task _fallbackStateReadingTask = null!;

    private MotionSensor(int gpio, Action onMotionOn, Action onMotionOff)
    {
        _gpio = gpio;
        _onMotionOn = (sender, args) => onMotionOn();
        _onMotionOff = (sender, args) => onMotionOff();
    }

    public async void Run(CancellationToken cancellationToken)
    {
        if (_fallbackStateReadingTask != null)
            throw new InvalidOperationException("This motion sensor is already active");

        _gpioController = new GpioController();
        _gpioController.OpenPin(_gpio, PinMode.InputPullDown);

        _gpioController.RegisterCallbackForPinValueChangedEvent(
            _gpio,
            PinEventTypes.Rising,
            _onMotionOn
            );

        _gpioController.RegisterCallbackForPinValueChangedEvent(
            _gpio,
            PinEventTypes.Falling,
            _onMotionOff
            );

        _fallbackStateReadingTask = new Task(
            async () =>
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var pinValue = _gpioController.Read(_gpio);
                    if (pinValue == PinValue.High)
                    {
                        _onMotionOn.Invoke(this, new PinValueChangedEventArgs(PinEventTypes.None, _gpio));
                    }
                    else
                    {
                        _onMotionOff.Invoke(this, new PinValueChangedEventArgs(PinEventTypes.None, _gpio));
                    }
                    await Task.Delay(10000);
                }
            },
            cancellationToken,
            TaskCreationOptions.LongRunning | TaskCreationOptions.PreferFairness);
    }

    public static MotionSensor CreateSensor(int gpio, Action onMotionOn, Action onMotionOff)
    {
        return new MotionSensor(gpio, onMotionOn, onMotionOff);
    }

    public void Dispose()
    {
        _gpioController?.UnregisterCallbackForPinValueChangedEvent(_gpio, _onMotionOn);
        _gpioController?.UnregisterCallbackForPinValueChangedEvent(_gpio, _onMotionOff);
        _gpioController?.Dispose();
    }
}

