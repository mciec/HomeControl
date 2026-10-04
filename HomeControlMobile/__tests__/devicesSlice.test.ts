/**
 * @format
 */
import reducer, {
  animationLocallyExpired,
  deviceStateChanged,
  setSelectedDevice,
} from '../src/store/devicesSlice';
import type { DeviceDetail } from '../src/services/devicesApi';

const animation = {
  animationName: 'FlyingBalls',
  direction: 'Left' as const,
  source: 'Override' as const,
  startedAtUtc: '2026-10-04T12:00:00.000Z',
  endsAtUtc: '2026-10-04T12:00:25.000Z',
};

function detail(serverTimeUtc: string, currentAnimation: typeof animation | null = null): DeviceDetail {
  return {
    id: 'entrance-led-strip',
    name: 'Entrance LED Strip',
    type: 'LedStripeWithSensors',
    state: { lastOverrideLeftReceivedUtc: null, lastOverrideRightReceivedUtc: null, currentAnimation, serverTimeUtc },
  };
}

describe('devicesSlice server clock offset', () => {
  afterEach(() => jest.useRealTimers());

  it('measures the offset between the server clock and the local clock when a detail arrives', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    // Server is 8s ahead of this device's clock.
    const state = reducer(undefined, setSelectedDevice(detail('2026-10-04T12:00:08.000Z')));
    expect(state.serverClockOffsetMs).toBe(8000);
  });

  it('re-measures the offset on every pushed state and keeps the previous one if the timestamp is unparseable', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00.000Z'));
    let state = reducer(undefined, setSelectedDevice(detail('2026-10-04T12:00:00.000Z')));
    state = reducer(
      state,
      deviceStateChanged({
        deviceId: 'entrance-led-strip',
        type: 'LedStripeWithSensors',
        state: detail('2026-10-04T11:59:58.000Z', animation).state,
      }),
    );
    expect(state.serverClockOffsetMs).toBe(-2000);
    expect(state.selectedDevice?.type === 'LedStripeWithSensors' && state.selectedDevice.state.currentAnimation).toEqual(animation);

    state = reducer(
      state,
      deviceStateChanged({
        deviceId: 'entrance-led-strip',
        type: 'LedStripeWithSensors',
        state: detail('not-a-date').state,
      }),
    );
    expect(state.serverClockOffsetMs).toBe(-2000);
  });

  it('only locally expires the exact animation that ended', () => {
    let state = reducer(undefined, setSelectedDevice(detail('2026-10-04T12:00:00.000Z', animation)));
    state = reducer(state, animationLocallyExpired({ deviceId: 'entrance-led-strip', startedAtUtc: 'some-other-start' }));
    expect(state.selectedDevice?.type === 'LedStripeWithSensors' && state.selectedDevice.state.currentAnimation).toEqual(animation);

    state = reducer(state, animationLocallyExpired({ deviceId: 'entrance-led-strip', startedAtUtc: animation.startedAtUtc }));
    expect(state.selectedDevice?.type === 'LedStripeWithSensors' && state.selectedDevice.state.currentAnimation).toBeNull();
  });
});
