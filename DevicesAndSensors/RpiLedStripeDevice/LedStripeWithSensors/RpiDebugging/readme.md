In order to add the program to cron:

1. edit cron file:
	$ crontab -e
2. add the below line to crontab:
	@reboot sh /home/mciec/runLedStripeWithSensors.sh
3. create the running script:
	$ nano /home/mciec/runLedStripeWithSensors.sh

	#!/bin/sh
	export DOTNET_LEDSTRIPEWITHSENSORS_MqttConfig__Password={the "raspberry" broker password (user secret Broker:DevicePassword)}
	cd /home/mciec/projects/LedStripeWithSensors
	/home/mciec/.dotnet/dotnet LedStripeWithSensors.dll

	and add execution right to runLedStripeWithSensors.sh:
	$ chmod +x /home/mciec/runLedStripeWithSensors.sh

To build, copy and (re)start the app on the Pi from WSL/Linux in one step:
	$ ./deploy-to-device.sh        (see its header for the one-time ssh-copy-id and the broker password)
It also writes the run script above (with the password) for you.
