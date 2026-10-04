import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DeviceDetail, DeviceSummary } from '../services/devicesApi';
import type { DeviceStateChangedPayload } from '../services/deviceHub';

interface DevicesState {
  devices: DeviceSummary[];
  listLoading: boolean;
  listError: string | null;
  selectedDevice: DeviceDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  // Server clock minus local clock (ms), re-measured each time a device state
  // arrives. Add it to Date.now() to get server time.
  serverClockOffsetMs: number;
}

// Offset of the server's clock from this client's, from a state's serverTimeUtc.
// Network latency makes it under-read by the one-way trip time (tens of ms).
function clockOffsetFrom(serverTimeUtc: string): number | null {
  const offset = Date.parse(serverTimeUtc) - Date.now();
  return Number.isNaN(offset) ? null : offset;
}

const initialState: DevicesState = {
  devices: [],
  listLoading: false,
  listError: null,
  selectedDevice: null,
  detailLoading: false,
  detailError: null,
  serverClockOffsetMs: 0,
};

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    setListLoading: (state, action: PayloadAction<boolean>) => {
      state.listLoading = action.payload;
    },
    setDevices: (state, action: PayloadAction<DeviceSummary[]>) => {
      state.devices = action.payload;
      state.listLoading = false;
      state.listError = null;
    },
    setListError: (state, action: PayloadAction<string>) => {
      state.listError = action.payload;
      state.listLoading = false;
    },
    setDetailLoading: (state, action: PayloadAction<boolean>) => {
      state.detailLoading = action.payload;
    },
    setSelectedDevice: (state, action: PayloadAction<DeviceDetail>) => {
      state.selectedDevice = action.payload;
      state.serverClockOffsetMs = clockOffsetFrom(action.payload.state.serverTimeUtc) ?? state.serverClockOffsetMs;
      state.detailLoading = false;
      state.detailError = null;
    },
    setDetailError: (state, action: PayloadAction<string>) => {
      state.detailError = action.payload;
      state.detailLoading = false;
    },
    clearSelectedDevice: (state) => {
      state.selectedDevice = null;
      state.detailError = null;
      state.detailLoading = false;
    },
    // Merges a SignalR-pushed state update into the currently-selected
    // device, if it's the one the update is about. Switch on `type` so a
    // future device type only needs a new case here, not a rewrite.
    deviceStateChanged: (state, action: PayloadAction<DeviceStateChangedPayload>) => {
      const current = state.selectedDevice;
      if (!current || current.id !== action.payload.deviceId) {
        return;
      }

      switch (action.payload.type) {
        case 'LedStripeWithSensors':
          if (current.type === 'LedStripeWithSensors') {
            current.state = action.payload.state;
            state.serverClockOffsetMs =
              clockOffsetFrom(action.payload.state.serverTimeUtc) ?? state.serverClockOffsetMs;
          }
          break;
      }
    },
    // Client-side fallback for when an animation's duration elapses locally
    // but no corresponding `Stopped` push ever arrives (dropped MQTT
    // message, hub hiccup, etc.). Guarded so it can never clobber a newer
    // animation: only clears if the device is still selected and its
    // `currentAnimation` is still the exact one (by startedAtUtc) that
    // locally expired.
    animationLocallyExpired: (state, action: PayloadAction<{ deviceId: string; startedAtUtc: string }>) => {
      const current = state.selectedDevice;
      if (!current || current.id !== action.payload.deviceId) {
        return;
      }
      if (current.type === 'LedStripeWithSensors'
          && current.state.currentAnimation?.startedAtUtc === action.payload.startedAtUtc) {
        current.state.currentAnimation = null;
      }
    },
  },
});

export const {
  setListLoading,
  setDevices,
  setListError,
  setDetailLoading,
  setSelectedDevice,
  setDetailError,
  clearSelectedDevice,
  deviceStateChanged,
  animationLocallyExpired,
} = devicesSlice.actions;
export default devicesSlice.reducer;
