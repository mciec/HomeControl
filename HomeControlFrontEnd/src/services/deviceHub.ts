import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import type { IRetryPolicy, RetryContext } from '@microsoft/signalr';
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

// Backoff schedule for automatic-reconnect attempts, in milliseconds. Unlike
// SignalR's default policy (`[0, 2000, 10000, 30000]`, then give up for good
// after ~42s with no further attempts), this repeats its last (30s) entry
// forever - see IndefiniteBackoffRetryPolicy below. This page keeps a
// persistent hub connection for as long as it's mounted, so it should keep
// trying to get live updates back rather than going permanently silent until
// the user manually reloads.
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 15000, 30000];

class IndefiniteBackoffRetryPolicy implements IRetryPolicy {
  nextRetryDelayInMilliseconds(retryContext: RetryContext): number {
    const { previousRetryCount } = retryContext;
    return RECONNECT_DELAYS_MS[Math.min(previousRetryCount, RECONNECT_DELAYS_MS.length - 1)];
  }
}

export function createDeviceHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect(new IndefiniteBackoffRetryPolicy())
    .build();
}

export function subscribeToDeviceStateChanged(
  connection: HubConnection,
  handler: (payload: DeviceStateChangedPayload) => void
): void {
  connection.on('DeviceStateChanged', (payload: DeviceStateChangedPayload) => {
    console.log('[deviceHub] DeviceStateChanged received', payload?.deviceId, payload?.type);
    handler(payload);
  });
}

export function onDeviceHubReconnected(connection: HubConnection, handler: () => void): void {
  connection.onreconnected(() => handler());
}

// Fires while an automatic-reconnect attempt is in progress (connection just
// dropped, a retry is queued). Logging-only for now - there is nothing
// visible to do here since the connection isn't usable yet.
export function onDeviceHubReconnecting(connection: HubConnection, handler?: (error?: Error) => void): void {
  connection.onreconnecting((error) => {
    console.warn('[deviceHub] connection lost, attempting to reconnect', error);
    handler?.(error);
  });
}

// Fires when the connection closes *permanently* - either the initial
// `start()` never got a connection up, or automatic-reconnect's retry policy
// gave up (not applicable to IndefiniteBackoffRetryPolicy above, which never
// does) - or `stop()` was called deliberately (e.g. page unmount). Wiring
// this up at all is new: previously a silent terminal disconnect had no
// logging and no recovery path short of a manual page reload.
export function onDeviceHubClosed(connection: HubConnection, handler?: (error?: Error) => void): void {
  connection.onclose((error) => {
    console.error('[deviceHub] connection closed', error);
    handler?.(error);
  });
}

export async function startDeviceHubConnection(connection: HubConnection): Promise<void> {
  await connection.start();
  console.log('[deviceHub] connection started', connection.connectionId);
}

export async function stopDeviceHubConnection(connection: HubConnection): Promise<void> {
  if (connection.state !== HubConnectionState.Disconnected) {
    await connection.stop();
  }
}
