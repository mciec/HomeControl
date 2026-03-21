In order to add the program to cron:

1. edit cron file:
	$ crontab -e
2. add the below line to crontab:
	@reboot sh /home/mciec/runLedStripeWithSensors.sh
3. create the running script:
	$ nano /home/mciec/runLedStripeWithSensors.sh

	#!/bin/sh
	export DOTNET_LEDSTRIPEWITHSENSORS_MqttConfig__Password={your MQTT password}
	cd /home/mciec/projects/LedStripeWithSensors
	/home/mciec/.dotnet/dotnet LedStripeWithSensors.dll

	and add execution right to runLedStripeWithSensors.sh:
	$ chmod +x /home/mciec/projects/runLedStripeWithSensors.sh