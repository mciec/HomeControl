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
}

const initialState: DevicesState = {
  devices: [],
  listLoading: false,
  listError: null,
  selectedDevice: null,
  detailLoading: false,
  detailError: null,
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
          }
          break;
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
} = devicesSlice.actions;
export default devicesSlice.reducer;
