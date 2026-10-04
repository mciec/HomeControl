export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Devices: undefined;
};

export type DevicesStackParamList = {
  DevicesList: undefined;
  DeviceDetail: { deviceId: string };
};
