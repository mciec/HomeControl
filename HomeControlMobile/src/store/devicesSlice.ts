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
  // arrives. Add it to Date.now() to get server time - see serverNow().
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
    // Client-side fallback for when a Stopped push never arrives (dropped
    // MQTT message, hub hiccup, etc.): once the local countdown for an
    // animation reaches its endsAtUtc, this clears it so the UI reverts to a
    // plain override button instead of a permanently-drained progress bar.
    // Guarded on both deviceId and startedAtUtc still matching so a stale
    // timer can never clobber a genuinely newer animation (e.g. one that
    // started in the same instant the old one's timer fired).
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
