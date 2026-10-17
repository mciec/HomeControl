# Embedded MQTT broker

[Eclipse Mosquitto](https://github.com/eclipse-mosquitto/mosquitto) 2.1.2 (source in [`../ThirdParty/mosquitto`](../ThirdParty/README.md))
runs **inside the same container as the backend**. The root `Dockerfile` compiles it (stage `mosquitto-build`) and
copies the result into the runtime image next to the published backend.

| File | Role |
|---|---|
| `entrypoint.sh` | Container entrypoint. If `BROKER_BACKEND_PASSWORD` and `BROKER_DEVICE_PASSWORD` are set: writes the password file (`/run/mosquitto/passwd`, hashed, never persisted), starts Mosquitto, points the backend at it (`Mqtt__*`, `Broker__WebSocketTarget`). Then runs the backend. If either process dies the container exits and is restarted. Without those variables no broker is started and the backend uses whatever external broker its `Mqtt__*` settings name. |
| `mosquitto.conf` | Two **loopback-only** listeners: `1883` (MQTT, used by the backend) and `9001` (MQTT over WebSocket). Password-file + ACL-file plugins, anonymous access off, no persistence. |
| `aclfile` | Who may do what: `homecontrol-backend` reads `entrance/motion` and `entrance/motion-triggers`, writes `entrance/override` and `entrance/motion-triggers/set`; `raspberry` the reverse. Everything else is denied. |

## How clients connect

```
Raspberry Pi ──wss://<app fqdn>/mqtt──► Container Apps ingress (TLS, :443) ──► backend /mqtt ──► Mosquitto :9001
backend ──────────── tcp 127.0.0.1:1883 ───────────────────────────────────────────────────────► Mosquitto
```

* **Encryption:** everything leaving the container is TLS - the platform's ingress terminates HTTPS/WSS on 443 with a publicly trusted certificate. Mosquitto itself never listens on a public interface, so it needs no certificate of its own.
* **Forwarder:** `HomeControlBackEnd/Features/Broker/MqttWebSocketProxy.cs` copies WebSocket messages, both ways, between the client and Mosquitto's WebSocket listener. It adds no authentication of its own: the broker authenticates (user + password) and authorizes (ACL) every client.
* **Clients:** the Raspberry Pi uses the shared `MqttManager` library (HiveMQtt) with `MqttConfig:WebSocketServer`. A browser or mobile MQTT client can use the same URL with any MQTT-over-WebSocket library (sub-protocol `mqtt`).
* **Why not `mqtts://…:8883`:** see "MQTT broker" in [AZURE_DEPLOYMENT.md](../AZURE_DEPLOYMENT.md) (external TCP ports need a custom-VNet Container Apps environment).

## Secrets

None are in the repo. The two passwords are random strings that `deploy-azure-aca.sh` generates on the first deploy, stores in the deploying machine's `dotnet user-secrets` (`Broker:BackendPassword`, `Broker:DevicePassword`) and hands to Azure as Container App secrets. The password file is generated from them on every container start.

## Adding a user or topic

Add the user to `entrypoint.sh` (one more `mosquitto_passwd -b` + a new secret/env var in `deploy-azure-aca.sh`) and its permissions to `aclfile`; keep the topic names in step with `Devices` in `HomeControlBackEnd/appsettings.json`.

## Trying it locally

Build Mosquitto like the Dockerfile does (`cmake -S ThirdParty/mosquitto -B build -DWITH_TESTS=OFF -DWITH_DOCS=OFF -DWITH_HTTP_API=OFF -DWITH_CTRL_SHELL=OFF ...`), or just build and run the image: `docker build -t homecontrol .` and run it with `-e BROKER_BACKEND_PASSWORD=... -e BROKER_DEVICE_PASSWORD=... -e Google__ClientId=x -e Google__ClientSecret=y -p 8080:8080`; a client can then connect to `ws://localhost:8080/mqtt`.
