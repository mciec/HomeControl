/**
 * @format
 */
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, create } from 'react-test-renderer';
import devicesReducer from '../src/store/devicesSlice';
import authReducer from '../src/store/authSlice';
import LedStripeWithSensorsDetail from '../src/components/devices/LedStripeWithSensorsDetail';
import { devicesService } from '../src/services/devicesApi';

jest.mock('../src/services/devicesApi', () => ({
  devicesService: { sendOverride: jest.fn(), setMotionTriggers: jest.fn() },
}));

const state = {
  lastOverrideLeftReceivedUtc: null,
  lastOverrideRightReceivedUtc: null,
  currentAnimation: null,
  motionTriggersEnabled: true,
  serverTimeUtc: '2026-10-04T12:00:00.000Z',
};
const store = () => configureStore({ reducer: { devices: devicesReducer, auth: authReducer } });

describe('LedStripeWithSensorsDetail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('notifies the screen after an override was accepted, so it can refresh independently of SignalR', async () => {
    (devicesService.sendOverride as jest.Mock).mockResolvedValue(undefined);
    const onOverrideSent = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={store()}>
          <LedStripeWithSensorsDetail deviceId="d1" state={state} onOverrideSent={onOverrideSent} />
        </Provider>,
      );
    });
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Override Left' }).props.onPress();
    });
    expect(devicesService.sendOverride).toHaveBeenCalledWith('d1', 'Left');
    expect(onOverrideSent).toHaveBeenCalledTimes(1);
  });

  it('does not notify when the backend rejects the override', async () => {
    (devicesService.sendOverride as jest.Mock).mockRejectedValue(new Error('503'));
    const onOverrideSent = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={store()}>
          <LedStripeWithSensorsDetail deviceId="d1" state={state} onOverrideSent={onOverrideSent} />
        </Provider>,
      );
    });
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Override Right' }).props.onPress();
    });
    expect(onOverrideSent).not.toHaveBeenCalled();
  });

  it('sends the new motion-detectors setting and shows it as updating until the device confirms', async () => {
    (devicesService.setMotionTriggers as jest.Mock).mockResolvedValue(undefined);
    const onMotionTriggersSent = jest.fn();
    const render = (motionTriggersEnabled: boolean | null) => (
      <Provider store={store()}>
        <LedStripeWithSensorsDetail
          deviceId="d1"
          state={{ ...state, motionTriggersEnabled }}
          onMotionTriggersSent={onMotionTriggersSent}
        />
      </Provider>
    );
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(render(true));
    });
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Motion detectors' }).props.onValueChange(false);
    });
    expect(devicesService.setMotionTriggers).toHaveBeenCalledWith('d1', false);
    expect(onMotionTriggersSent).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ accessibilityLabel: 'Motion detectors: Updating...' })).toBeTruthy();

    act(() => {
      tree.update(render(false));
    });
    expect(tree.root.findByProps({ accessibilityLabel: 'Motion detectors: Off' })).toBeTruthy();
  });

  it('disables the switch until the device has reported its state', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={store()}>
          <LedStripeWithSensorsDetail deviceId="d1" state={{ ...state, motionTriggersEnabled: null }} />
        </Provider>,
      );
    });
    expect(tree.root.findByProps({ accessibilityLabel: 'Motion detectors' }).props.disabled).toBe(true);
  });
});
