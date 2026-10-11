#!/bin/bash
# Container entrypoint: runs the embedded Mosquitto broker next to the HomeControl backend.
#
# The broker is started only when both BROKER_BACKEND_PASSWORD and BROKER_DEVICE_PASSWORD are set
# (Container App secrets, never baked into the image). Without them the backend simply runs against
# whatever external broker its Mqtt__* settings point at, so the other deployment targets keep working.
#
# If either process exits, the container exits too, so the platform restarts both.
set -euo pipefail

BACKEND_USER="homecontrol-backend"   # must match the users in /etc/mosquitto/aclfile
DEVICE_USER="raspberry"
RUN_DIR=/run/mosquitto

pids=()
shutdown() { kill "${pids[@]}" 2>/dev/null || true; }
trap shutdown TERM INT

if [ -n "${BROKER_BACKEND_PASSWORD:-}" ] && [ -n "${BROKER_DEVICE_PASSWORD:-}" ]; then
  mkdir -p "$RUN_DIR"
  rm -f "$RUN_DIR/passwd"
  mosquitto_passwd -c -b "$RUN_DIR/passwd" "$BACKEND_USER" "$BROKER_BACKEND_PASSWORD"
  mosquitto_passwd -b "$RUN_DIR/passwd" "$DEVICE_USER" "$BROKER_DEVICE_PASSWORD"
  chown -R mosquitto:mosquitto "$RUN_DIR"
  chmod 600 "$RUN_DIR/passwd"

  /usr/sbin/mosquitto -c /etc/mosquitto/mosquitto.conf &
  pids+=("$!")

  for _ in $(seq 1 50); do
    (exec 3<>/dev/tcp/127.0.0.1/1883) 2>/dev/null && break
    kill -0 "${pids[0]}" 2>/dev/null || { echo "mosquitto exited during startup" >&2; exit 1; }
    sleep 0.2
  done

  # Point the backend at the local broker, and enable its /mqtt WebSocket forwarder.
  export Mqtt__Host=127.0.0.1 Mqtt__Port=1883 Mqtt__UseTLS=false
  export Mqtt__User="$BACKEND_USER" Mqtt__Password="$BROKER_BACKEND_PASSWORD"
  export Broker__WebSocketTarget=ws://127.0.0.1:9001
else
  echo "BROKER_*_PASSWORD not set - not starting the embedded MQTT broker." >&2
fi

unset BROKER_BACKEND_PASSWORD BROKER_DEVICE_PASSWORD

dotnet /app/HomeControlBackEnd.dll &
pids+=("$!")

# Returns as soon as either process exits (or a trapped signal arrives).
wait -n || true
shutdown
wait || true
exit 1
