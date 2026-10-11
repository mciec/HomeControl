In order to add the program to cron:

1. edit cron file:
	$ crontab -e
2. add the below line to crontab:
	@reboot sh /home/mciec/runLedStripeWithSensors.sh
3. create the running script:
	$ nano /home/mciec/runLedStripeWithSensors.sh

	#!/bin/sh
	export DOTNET_LEDSTRIPEWITHSENSORS_MqttConfig__Password={the "raspberry" broker password: dotnet user-secrets list --project HomeControlBackEnd, key Broker:DevicePassword}
	cd /home/mciec/projects/LedStripeWithSensors
	/home/mciec/.dotnet/dotnet LedStripeWithSensors.dll

	and add execution right to runLedStripeWithSensors.sh:
	$ chmod +x /home/mciec/runLedStripeWithSensors.sh