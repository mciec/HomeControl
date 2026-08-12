import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import type { LedStripeWithSensorsState } from './devicesApi';

// Payload pushed by the server's `DeviceStateChanged` hub event. Mirrors the
// `DeviceDetail` discriminated union (minus id/name) - add a new member here
// alongside a new `DeviceDetail` member when a new device type is introduced.
export type DeviceStateChangedPayload = {
  deviceId: string;
  type: 'LedStripeWithSensors';
  state: LedStripeWithSensorsState;
};

const HUB_URL = '/hubs/devices';

export function createDeviceHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .build();
}

export function subscribeToDeviceStateChanged(
  connection: HubConnection,
  handler: (payload: DeviceStateChangedPayload) => void
): void {
  connection.on('DeviceStateChanged', handler);
}

export function onDeviceHubReconnected(connection: HubConnection, handler: () => void): void {
  connection.onreconnected(() => handler());
}

export async function startDeviceHubConnection(connection: HubConnection): Promise<void> {
  await connection.start();
}

export async function stopDeviceHubConnection(connection: HubConnection): Promise<void> {
  if (connection.state !== HubConnectionState.Disconnected) {
    await connection.stop();
  }
}
