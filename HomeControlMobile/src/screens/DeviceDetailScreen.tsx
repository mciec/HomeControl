import { useCallback, useEffect } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HubConnection } from '@microsoft/signalr';
import { devicesService } from '../services/devicesApi';
import {
  createDeviceHubConnection,
  startDeviceHubConnection,
  stopDeviceHubConnection,
  subscribeToDeviceStateChanged,
  onDeviceHubReconnected,
  onDeviceHubReconnecting,
  onDeviceHubClosed,
} from '../services/deviceHub';
import {
  setDetailLoading,
  setSelectedDevice,
  setDetailError,
  clearSelectedDevice,
  deviceStateChanged,
  animationLocallyExpired,
} from '../store/devicesSlice';
import type { RootState } from '../store/store';
import type { DevicesStackParamList } from '../navigation/types';
import LedStripeWithSensorsDetail from '../components/devices/LedStripeWithSensorsDetail';
import Card from '../components/Card';
import { ErrorBox, IconTile, TypePill } from '../components/ui';
import { LedStripIcon } from '../components/icons/Icons';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<DevicesStackParamList, 'DeviceDetail'>;

// Small buffer added on top of the computed remaining time before firing the
// local-expiry fallback, so it never races ahead of a Stopped push that's
// already in flight for a natural (non-dropped) expiry.
const ANIMATION_EXPIRY_SAFETY_MARGIN_MS = 300;

// Unlike DevicesPage.tsx on the web (one component that swaps between a list
// view and a detail view, keeping a single hub connection alive across both),
// this screen is its own stack entry with the device id in its route params.
// So it owns the hub connection for exactly its own lifetime: connect+fetch
// on mount, disconnect+clear on unmount (i.e. navigating back to the list) -
// which lands on the same behavior without needing the web version's
// selectedDeviceIdRef indirection.
function DeviceDetailScreen({ route, navigation }: Props) {
  const { deviceId } = route.params;
  const dispatch = useDispatch();
  const { selectedDevice, detailLoading, detailError, serverClockOffsetMs } = useSelector((state: RootState) => state.devices);

  const fetchDetail = useCallback(async () => {
    dispatch(setDetailLoading(true));
    try {
      const detail = await devicesService.get(deviceId);
      dispatch(setSelectedDevice(detail));
      navigation.setOptions({ title: detail.name });
    } catch {
      dispatch(setDetailError('Failed to load device details'));
    }
  }, [deviceId, dispatch, navigation]);

  useEffect(() => {
    fetchDetail();

    const connection: HubConnection = createDeviceHubConnection();

    subscribeToDeviceStateChanged(connection, (payload) => {
      dispatch(deviceStateChanged(payload));
    });

    onDeviceHubReconnected(connection, () => {
      // A gap in live updates may have been missed while reconnecting -
      // re-fetch to resync (mirrors the mount-time fetchDetail).
      fetchDetail();
    });

    onDeviceHubReconnecting(connection);

    onDeviceHubClosed(connection, (err) => {
      console.error('Devices hub connection closed', deviceId, err);
    });

    startDeviceHubConnection(connection).catch((err) => {
      console.error('Failed to connect to devices hub', err);
    });

    return () => {
      stopDeviceHubConnection(connection).catch((err) => {
        console.error('Failed to disconnect from devices hub', err);
      });
      dispatch(clearSelectedDevice());
    };
    // fetchDetail is stable enough here (only deviceId/dispatch/navigation
    // change, none of which should re-run the hub connection setup mid-visit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // Client-side fallback: a Stopped push may never arrive (dropped MQTT
  // message, hub hiccup, etc.), so also schedule a local expiry once the
  // current animation's own endsAtUtc has passed. The reducer's own guard
  // (deviceId + startedAtUtc match) is what actually prevents a stale timer
  // from clobbering a newer animation - clearing the timer on cleanup here is
  // belt-and-suspenders so a timer from a previous animation/device/unmounted
  // screen doesn't fire at all.
  useEffect(() => {
    if (!selectedDevice || selectedDevice.type !== 'LedStripeWithSensors') {
      return;
    }
    const animation = selectedDevice.state.currentAnimation;
    if (!animation) {
      return;
    }

    const currentDeviceId = selectedDevice.id;
    const { startedAtUtc, endsAtUtc } = animation;
    const endsAtMs = Date.parse(endsAtUtc);

    const expire = () => {
      dispatch(animationLocallyExpired({ deviceId: currentDeviceId, startedAtUtc }));
    };

    // Server time, not the device's clock - see serverClockOffsetMs.
    const remainingMs = endsAtMs - (Date.now() + serverClockOffsetMs);
    const timeoutId = setTimeout(expire, remainingMs > 0 ? remainingMs + ANIMATION_EXPIRY_SAFETY_MARGIN_MS : 0);

    // setTimeout can be throttled or suspended while the app is backgrounded
    // (iOS/Android both do this). Re-check on foregrounding so a stalled
    // timer doesn't leave a fully-drained progress bar showing indefinitely
    // after the user returns - if endsAtUtc has already passed by then,
    // expire right away instead of waiting on the (possibly still-delayed)
    // timer to catch up.
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && Date.now() + serverClockOffsetMs >= endsAtMs) {
        expire();
      }
    });

    return () => {
      clearTimeout(timeoutId);
      appStateSubscription.remove();
    };
  }, [dispatch, selectedDevice, serverClockOffsetMs]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        {detailError && (
          <View style={styles.errorWrap}>
            <ErrorBox message={detailError} />
          </View>
        )}

        {detailLoading && !selectedDevice ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : selectedDevice ? (
          <>
            <View style={styles.header}>
              <IconTile>
                <LedStripIcon size={22} color={colors.accentSoft} />
              </IconTile>
              <View style={styles.headerText}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {selectedDevice.name}
                </Text>
                <TypePill label={selectedDevice.type} />
              </View>
            </View>
            <View style={styles.body}>
              {selectedDevice.type === 'LedStripeWithSensors' && (
                <LedStripeWithSensorsDetail deviceId={selectedDevice.id} state={selectedDevice.state} />
              )}
            </View>
          </>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  centered: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  errorWrap: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  deviceName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    padding: spacing.lg - 4,
  },
});

export default DeviceDetailScreen;
