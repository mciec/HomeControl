import apiClient from './api';

export type DeviceType = 'LedStripeWithSensors';

export type OverrideDirection = 'Left' | 'Right';

export interface DeviceSummary {
  id: string;
  name: string;
  type: DeviceType;
}

export interface LedStripeWithSensorsState {
  lastOverrideLeftReceivedUtc: string | null;
  lastOverrideRightReceivedUtc: string | null;
}

// Discriminated union on `type` - add a new member here (and a matching
// branch wherever DeviceDetail is switched on) when a new device type is
// introduced.
export type DeviceDetail = {
  id: string;
  name: string;
  type: 'LedStripeWithSensors';
  state: LedStripeWithSensorsState;
};

export interface ApiErrorBody {
  message: string;
}

export const devicesService = {
  list: async (): Promise<DeviceSummary[]> => {
    const response = await apiClient.get<DeviceSummary[]>('/devices');
    return response.data;
  },

  get: async (id: string): Promise<DeviceDetail> => {
    const response = await apiClient.get<DeviceDetail>(`/devices/${id}`);
    return response.data;
  },

  sendOverride: async (id: string, direction: OverrideDirection): Promise<void> => {
    await apiClient.post(`/devices/${id}/override`, { direction });
  },
};
