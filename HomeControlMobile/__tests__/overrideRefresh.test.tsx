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
  devicesService: { sendOverride: jest.fn() },
}));

const state = {
  lastOverrideLeftReceivedUtc: null,
  lastOverrideRightReceivedUtc: null,
  currentAnimation: null,
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
});
