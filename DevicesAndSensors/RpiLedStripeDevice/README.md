A project for RaspberryPi and .NET.
There should be 2 motion detectors conected to the pins configured in appsettings file:
"MotionSensorsConfig": {
  "LeftMotionDetectorPin": 6,
  "RightMotionDetectorPin": 11
}
The high singal means the motion is detected. I'm using PIC HC-SR501:
https://botland.com.pl/czujniki-ruchu/1655-czujnik-ruchu-pir-hc-sr501-zielony-justpi-5903351241359.html
The detectors should be mounted at the 2 endings of a programable LED stripe. I'm using WS2811:
https://botland.com.pl/paski-led-adresowane/5449-pasek-led-rgb-ws2811-cyfrowy-adresowany-ip65-30-ledm-72wm-12v-5m-5904422303044.html
The program detects the motion and - based on which ending the motion comes from - displays
and "inviting" animation, guiding the way.
The program also sends the information about the detected motion to MQTT topic/queue (queue's name configured 
in appsettings):
"MotionDetectedTopic": "entrance/motion"
than a Blazor app will show, presumably on a smartphone (work in progress).
The only messages sent are "LEFT" and "RIGHT".
There's also a separate MQTT topic for running the animation on demand (also to use in a Blazor app):
"OverrideTopic": "entrance/override"
The app is capable to work without internet connection. There's a retry mechanism handling all of 
the MQTT connection stuff.
It tries to connect and send information about detected motion to MQTT, but gives up (per messsage) after the
message lifetime expires (here: 10s). Something like POLLY, but not exactly.
The animation is only being run after the sunset, based on the daytime hardcoded for Poland.
The RaspberryPi doesn't have built in real time clock with battery, so the timing depends on the internet connection.
There is also a Blazor "simulator" project for LED stripe animations, allowing for testing various animations 
without actual connection to the LED stripe.
The PCB schema for mounting the Raspberry PI Zero2W will be added soon (gerber file). It's only for converting shared
12V power supply (for the 5m long LED stripe) -> 5V (for RaspberryPi) and connecting input and output wires.
This is a second approach to making home lighting system, the previous one, made for RaspberryPi PICO is here:
https://github.com/mciec/rpi-pico-led-stripe-motion-sensor
It's working, but unstable. Here is also a mechanism allowing it to work without internet connection, but after 
a long battle I gave it up and decided to rewrite it in C#. Most like the instability was caused by my poor 
PCB soldering skills.
