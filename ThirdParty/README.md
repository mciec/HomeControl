# Third-party sources

## mosquitto/

[Eclipse Mosquitto](https://github.com/eclipse-mosquitto/mosquitto) **v2.1.2** (tag `v2.1.2`, commit `99fa50f`), copied here
from the GitHub release tarball - not a submodule or a fork. It is built from source by the `mosquitto-build`
stage of the root `Dockerfile` and runs inside the HomeControl container as the MQTT broker
(configuration: `../Broker/`). Licence: EPL-2.0 / EDL-1.0 (`mosquitto/LICENSE.txt`, `epl-v20`, `edl-v10`).

Changes against upstream: **none to the code**; only the directories `test/` (the test-suite, which ships
private keys for its throw-away test CAs - kept out so no key material lives in this repo) and `fuzzing/`
were removed. The image build passes `-DWITH_TESTS=OFF`, so neither is needed.

To upgrade: download the new release tarball, replace the contents of `mosquitto/` with it, delete `test/` and
`fuzzing/` again, and update the version above.
