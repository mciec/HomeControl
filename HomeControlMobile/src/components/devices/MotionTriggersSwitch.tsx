import { StyleSheet, Switch, Text, View } from 'react-native';
import { ErrorBox } from '../ui';
import { colors, radius } from '../../theme';

interface MotionTriggersSwitchProps {
  // null = the device hasn't reported its state yet.
  enabled: boolean | null;
  // True from the moment a change is requested until the device confirms it.
  pending: boolean;
  error: string | null;
  onChange: (enabled: boolean) => void;
}

// Switch for whether the motion detectors may start animations. When off, animations
// only run via the manual override buttons. Always shows the device's reported state.
function MotionTriggersSwitch({ enabled, pending, error, onChange }: MotionTriggersSwitchProps) {
  const status = enabled === null ? 'Waiting for device...' : pending ? 'Updating...' : enabled ? 'On' : 'Off';

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.labels}>
          <Text style={styles.title}>Motion detectors</Text>
          <Text
            style={[styles.status, enabled === true && !pending && styles.statusOn]}
            accessibilityLabel={`Motion detectors: ${status}`}
          >
            {status}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Motion detectors"
          value={enabled ?? false}
          disabled={enabled === null || pending}
          onValueChange={onChange}
          trackColor={{ false: colors.borderStrong, true: colors.accent }}
          thumbColor={colors.white}
        />
      </View>
      <Text style={styles.hint}>
        {enabled === false ? 'Animations run only via manual override.' : 'Animations start when motion is detected.'}
      </Text>
      {error && <ErrorBox message={error} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labels: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  status: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  statusOn: {
    color: colors.success,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
});

export default MotionTriggersSwitch;
