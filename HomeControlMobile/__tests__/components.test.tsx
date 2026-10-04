/**
 * @format
 */
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import devicesReducer from '../src/store/devicesSlice';
import authReducer from '../src/store/authSlice';
import OverrideControl from '../src/components/devices/OverrideControl';
import DeviceListItem from '../src/components/devices/DeviceListItem';
import Button from '../src/components/Button';

// Renders the redesigned UI under Jest (react-native-svg and the animation drivers are
// stubbed by the RN jest preset), checking behaviour rather than pixels.
function textOf(node: ReactTestInstance): string {
  return node
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => n.children.join(''))
    .join(' | ');
}

const makeStore = () => configureStore({ reducer: { devices: devicesReducer, auth: authReducer } });

describe('device components', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:10.000Z')));
  afterEach(() => jest.useRealTimers());

  it('shows a labelled override button while idle and calls back on press', () => {
    const onOverride = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={makeStore()}>
          <OverrideControl direction="Left" currentAnimation={null} loading={false} error={null} onOverride={onOverride} />
        </Provider>,
      );
    });
    expect(textOf(tree.root)).toContain('Override Left');
    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Override Left' }).props.onPress();
    });
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('replaces the button with a progress bar for the animating direction, labelled by source', () => {
    const animation = {
      animationName: 'FlyingBalls',
      direction: 'Right' as const,
      source: 'Motion' as const,
      startedAtUtc: '2026-10-04T12:00:00.000Z',
      endsAtUtc: '2026-10-04T12:00:25.000Z',
    };
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={makeStore()}>
          <OverrideControl direction="Right" currentAnimation={animation} loading={false} error={null} onOverride={jest.fn()} />
        </Provider>,
      );
    });
    expect(textOf(tree.root)).toContain('Motion Right — FlyingBalls');
    // 10s of 25s elapsed against the (zero-offset) clock => 60% remaining.
    const bar = tree.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(bar.props.accessibilityValue.now).toBe(60);
  });

  it('counts down against server time, not the device clock', () => {
    const store = makeStore();
    const animation = {
      animationName: 'FlyingBalls',
      direction: 'Left' as const,
      source: 'Override' as const,
      startedAtUtc: '2026-10-04T12:00:00.000Z',
      endsAtUtc: '2026-10-04T12:00:25.000Z',
    };
    // Device clock reads 12:00:10 but the server is 5s behind it => 20s of 25s remain (80%).
    store.dispatch({
      type: 'devices/setSelectedDevice',
      payload: {
        id: 'x', name: 'x', type: 'LedStripeWithSensors',
        state: { lastOverrideLeftReceivedUtc: null, lastOverrideRightReceivedUtc: null, currentAnimation: null, serverTimeUtc: '2026-10-04T12:00:05.000Z' },
      },
    });
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <Provider store={store}>
          <OverrideControl direction="Left" currentAnimation={animation} loading={false} error={null} onOverride={jest.fn()} />
        </Provider>,
      );
    });
    expect(tree.root.findByProps({ accessibilityRole: 'progressbar' }).props.accessibilityValue.now).toBe(80);
  });

  it('renders a device row that selects its device', () => {
    const onSelect = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<DeviceListItem device={{ id: 'd1', name: 'Entrance LED Strip', type: 'LedStripeWithSensors' }} onSelect={onSelect} />);
    });
    expect(textOf(tree.root)).toContain('Entrance LED Strip');
    expect(textOf(tree.root)).toContain('LedStripeWithSensors');
    act(() => {
      tree.root.findByProps({ accessibilityLabel: 'Entrance LED Strip, LedStripeWithSensors' }).props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('d1');
  });
});

describe('Button', () => {
  it('does not fire while loading or disabled', () => {
    const onPress = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Button label="Go" onPress={onPress} loading />);
    });
    const pressable = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });
});
