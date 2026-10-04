import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import axios from 'axios';
import {
  devicesService,
  type LedStripeWithSensorsState,
  type OverrideDirection,
} from '../../services/devicesApi';
import OverrideControl from './OverrideControl';
import { SectionLabel } from '../ui';
import { spacing } from '../../theme';

interface LedStripeWithSensorsDetailProps {
  deviceId: string;
  state: LedStripeWithSensorsState;
  // Called after the backend accepted an override (HTTP 202) so the screen can refresh the device
  // state shortly afterwards, independent of the live-update connection.
  onOverrideSent?: () => void;
}

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
}: LedStripeWithSensorsDetailProps) {
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);

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
