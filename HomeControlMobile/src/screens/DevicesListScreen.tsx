import { useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { devicesService } from '../services/devicesApi';
import { setListLoading, setDevices, setListError } from '../store/devicesSlice';
import type { RootState } from '../store/store';
import type { DevicesStackParamList } from '../navigation/types';
import DeviceListItem from '../components/devices/DeviceListItem';
import Card from '../components/Card';
import { ErrorBox } from '../components/ui';
import { DevicesIcon } from '../components/icons/Icons';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<DevicesStackParamList, 'DevicesList'>;

function DevicesListScreen({ navigation }: Props) {
  const dispatch = useDispatch();
  const { devices, listLoading, listError } = useSelector((state: RootState) => state.devices);

  useEffect(() => {
    const fetchDevices = async () => {
      dispatch(setListLoading(true));
      try {
        const list = await devicesService.list();
        dispatch(setDevices(list));
      } catch {
        dispatch(setListError('Failed to load devices'));
      }
    };
    fetchDevices();
  }, [dispatch]);

  return (
    <View style={styles.screen}>
      <Card>
        <View style={styles.header}>
          <DevicesIcon size={20} color={colors.accent} />
          <Text style={styles.headerText}>Devices</Text>
        </View>
        <View style={styles.body}>
          {listError && <ErrorBox message={listError} />}
          {listLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : devices.length === 0 ? (
            <Text style={styles.emptyText}>No devices found.</Text>
          ) : (
            <FlatList
              data={devices}
              scrollEnabled={false}
              keyExtractor={(device) => device.id}
              renderItem={({ item }) => (
                <DeviceListItem
                  device={item}
                  onSelect={(deviceId) => navigation.navigate('DeviceDetail', { deviceId })}
                />
              )}
            />
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  body: {
    padding: spacing.sm,
  },
  centered: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    padding: spacing.md,
  },
});

export default DevicesListScreen;
