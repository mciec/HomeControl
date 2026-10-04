/**
 * @format
 */
// Regression test for "TypeError: cannot assign to property 'pathname' which has only a getter":
// SignalR mutates URL.pathname while negotiating, which React Native's own URL class cannot do.
import '../src/polyfills';
import { createDeviceHubConnection } from '../src/services/deviceHub';

describe('SignalR negotiation under React Native', () => {
  it('the polyfilled URL allows assigning pathname (as SignalR does)', () => {
    const u = new URL('https://homecontrol.test/hubs/devices');
    // RN's own typings declare pathname read-only - the very limitation the polyfill removes.
    (u as { pathname: string }).pathname += '/negotiate';
    expect(u.pathname).toBe('/hubs/devices/negotiate');
  });

  it('builds the negotiate request and actually sends it', async () => {
    const g = globalThis as unknown as { fetch: unknown; window?: unknown };
    const realFetch = g.fetch;
    const calls: string[] = [];
    // Never resolves: we only care that a request is made (the bug prevented it from being sent at all).
    g.fetch = jest.fn((url: string) => {
      calls.push(String(url));
      return new Promise(() => {});
    });
    const connection = createDeviceHubConnection();
    connection.start().catch(() => {});
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    g.fetch = realFetch;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/\/hubs\/devices\/negotiate\?negotiateVersion=1$/);
    connection.stop().catch(() => {});
  });
});
