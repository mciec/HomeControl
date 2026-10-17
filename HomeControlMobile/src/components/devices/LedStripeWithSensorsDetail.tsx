import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import axios from 'axios';
import {
  devicesService,
  type LedStripeWithSensorsState,
  type OverrideDirection,
} from '../../services/devicesApi';
import OverrideControl from './OverrideControl';
import MotionTriggersSwitch from './MotionTriggersSwitch';
import { SectionLabel } from '../ui';
import { spacing } from '../../theme';

interface LedStripeWithSensorsDetailProps {
  deviceId: string;
  state: LedStripeWithSensorsState;
  // Called after the backend accepted an override (HTTP 202) so the screen can refresh the device
  // state shortly afterwards, independent of the live-update connection.
  onOverrideSent?: () => void;
  // Same, after a motion-detectors change was accepted.
  onMotionTriggersSent?: () => void;
}

// How long a requested motion-triggers change may stay unconfirmed before the switch falls back
// to the device's reported state.
const MOTION_TRIGGERS_CONFIRM_TIMEOUT_MS = 6000;

function extractErrorMessage(
  err: unknown,
  direction: OverrideDirection,
): string {
  if (
    axios.isAxiosError(err) &&
    typeof err.response?.data?.message === 'string'
  ) {
    return err.response.data.message;
  }
  return `Failed to send ${direction} override`;
}

function LedStripeWithSensorsDetail({
  deviceId,
  state,
  onOverrideSent,
  onMotionTriggersSent,
}: LedStripeWithSensorsDetailProps) {
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);

  const [motionRequested, setMotionRequested] = useState<boolean | null>(null);
  const [motionError, setMotionError] = useState<string | null>(null);

  // The change is confirmed once the device reports the requested state.
  useEffect(() => {
    if (motionRequested === null) {
      return;
    }
    if (state.motionTriggersEnabled === motionRequested) {
      setMotionRequested(null);
      return;
    }
    const timer = setTimeout(
      () => setMotionRequested(null),
      MOTION_TRIGGERS_CONFIRM_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [motionRequested, state.motionTriggersEnabled]);

  const handleMotionTriggers = async (enabled: boolean) => {
    setMotionRequested(enabled);
    setMotionError(null);
    try {
      await devicesService.setMotionTriggers(deviceId, enabled);
      onMotionTriggersSent?.();
    } catch (err) {
      setMotionRequested(null);
      setMotionError(
        axios.isAxiosError(err) &&
          typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Failed to change motion detectors setting',
      );
    }
  };

  const handleOverride = async (direction: OverrideDirection) => {
    const setLoading = direction === 'Left' ? setLeftLoading : setRightLoading;
    const setError = direction === 'Left' ? setLeftError : setRightError;

    setLoading(true);
    setError(null);
    try {
      await devicesService.sendOverride(deviceId, direction);
      onOverrideSent?.();
    } catch (err) {
      setError(extractErrorMessage(err, direction));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <SectionLabel>Motion detectors</SectionLabel>
      <MotionTriggersSwitch
        enabled={motionRequested ?? state.motionTriggersEnabled}
        pending={motionRequested !== null}
        error={motionError}
        onChange={handleMotionTriggers}
      />
      <SectionLabel>Manual override</SectionLabel>
      <View style={styles.row}>
        <View style={styles.column}>
          <OverrideControl
            direction="Left"
            currentAnimation={state.currentAnimation}
            loading={leftLoading}
            error={leftError}
            onOverride={() => handleOverride('Left')}
          />
        </View>
        <View style={styles.column}>
          <OverrideControl
            direction="Right"
            currentAnimation={state.currentAnimation}
            loading={rightLoading}
            error={rightError}
            onOverride={() => handleOverride('Right')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm + 4,
  },
  column: {
    width: '100%',
  },
});

export default LedStripeWithSensorsDetail;
