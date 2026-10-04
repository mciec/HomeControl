import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DeviceSummary } from '../../services/devicesApi';
import { ChevronRightIcon, LedStripIcon } from '../icons/Icons';
import { IconTile, TypePill } from '../ui';
import { colors, radius } from '../../theme';

interface DeviceListItemProps {
  device: DeviceSummary;
  onSelect: (id: string) => void;
}

function DeviceListItem({ device, onSelect }: DeviceListItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onSelect(device.id)}
      accessibilityRole="button"
      accessibilityLabel={`${device.name}, ${device.type}`}
    >
      <IconTile>
        <LedStripIcon size={22} color={colors.accentSoft} />
      </IconTile>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {device.name}
        </Text>
        <TypePill label={device.type} />
      </View>
      <ChevronRightIcon size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.lg,
  },
  pressed: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

export default DeviceListItem;
