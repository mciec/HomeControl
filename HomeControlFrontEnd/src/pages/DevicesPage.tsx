import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Card, Alert, ListGroup, Spinner } from 'react-bootstrap';
import type { HubConnection } from '@microsoft/signalr';
import { devicesService } from '../services/devicesApi';
import {
  createDeviceHubConnection,
  startDeviceHubConnection,
  stopDeviceHubConnection,
  subscribeToDeviceStateChanged,
  onDeviceHubReconnected,
  onDeviceHubReconnecting,
  onDeviceHubClosed,
} from '../services/deviceHub';
import {
  setListLoading,
  setDevices,
  setListError,
  setDetailLoading,
  setSelectedDevice,
  setDetailError,
  clearSelectedDevice,
  deviceStateChanged,
  animationLocallyExpired,
} from '../store/devicesSlice';
import type { RootState } from '../store/store';
import DeviceListItem from '../components/devices/DeviceListItem';
import LedStripeWithSensorsDetail from '../components/devices/LedStripeWithSensorsDetail';
import { ArrowLeftIcon, DevicesIcon, LedStripIcon } from '../components/icons/Icons';

function DevicesPage() {
  const dispatch = useDispatch();
  const { devices, listLoading, listError, selectedDevice, detailLoading, detailError, serverClockOffsetMs } = useSelector(
    (state: RootState) => state.devices
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  const fetchDetail = useCallback(
    async (id: string) => {
      dispatch(setDetailLoading(true));
      try {
        const detail = await devicesService.get(id);
        dispatch(setSelectedDevice(detail));
      } catch {
        dispatch(setDetailError('Failed to load device details'));
      }
    },
    [dispatch]
  );

  // Fetch the device list once, on mount.
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

  // Connect to the devices hub for the lifetime of this page, regardless of
  // which view (list/detail) is showing, and clean up on unmount.
  useEffect(() => {
    const connection: HubConnection = createDeviceHubConnection();

    subscribeToDeviceStateChanged(connection, (payload) => {
      dispatch(deviceStateChanged(payload));
    });

    onDeviceHubReconnected(connection, () => {
      const currentId = selectedDeviceIdRef.current;
      if (currentId) {
        fetchDetail(currentId);
      }
    });

    onDeviceHubReconnecting(connection);

    onDeviceHubClosed(connection, (err) => console.error('Devices hub connection closed', err));

    startDeviceHubConnection(connection).catch((err) => {
      console.error('Failed to connect to devices hub', err);
    });

    return () => {
      stopDeviceHubConnection(connection).catch((err) => {
        console.error('Failed to disconnect from devices hub', err);
      });
    };
  }, [dispatch, fetchDetail]);

  // Fetch the detail whenever a device is selected; clear it when going back.
  useEffect(() => {
    if (selectedDeviceId) {
      fetchDetail(selectedDeviceId);
    } else {
      dispatch(clearSelectedDevice());
    }
  }, [selectedDeviceId, fetchDetail, dispatch]);

  // Local-expiry fallback: if an animation's `endsAtUtc` passes without a
  // `Stopped` push ever arriving (dropped MQTT message, hub hiccup, etc.),
  // clear it from Redux ourselves so the UI reverts to a plain override
  // button instead of getting stuck on a fully-drained progress bar.
  const currentAnimation =
    selectedDevice?.type === 'LedStripeWithSensors' ? selectedDevice.state.currentAnimation : null;

  useEffect(() => {
    if (!currentAnimation || !selectedDevice) {
      return;
    }

    const deviceId = selectedDevice.id;
    const startedAtUtc = currentAnimation.startedAtUtc;
    // Server time, not the browser's clock - see serverClockOffsetMs.
    const msRemaining = Date.parse(currentAnimation.endsAtUtc) - (Date.now() + serverClockOffsetMs);
    const safetyMarginMs = 300;

    const timeoutId = setTimeout(
      () => {
        dispatch(animationLocallyExpired({ deviceId, startedAtUtc }));
      },
      Math.max(msRemaining + safetyMarginMs, 0)
    );

    return () => clearTimeout(timeoutId);
  }, [dispatch, selectedDevice, currentAnimation, serverClockOffsetMs]);

  const handleBack = () => {
    setSelectedDeviceId(null);
  };

  if (selectedDeviceId) {
    return (
      <Row className="justify-content-center w-100 mx-0 page-enter">
        <Col xs={12} sm={11} md={9} lg={6} xl={6} className="px-0">
          <button type="button" className="back-link btn" onClick={handleBack}>
            <ArrowLeftIcon size={18} /> Back to devices
          </button>

          {detailError && <Alert variant="danger">{detailError}</Alert>}

          {detailLoading && !selectedDevice ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : selectedDevice ? (
            <Card>
              <Card.Header className="d-flex align-items-center gap-3">
                <span className="icon-tile">
                  <LedStripIcon size={22} />
                </span>
                <span className="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
                  <strong className="d-block text-truncate">{selectedDevice.name}</strong>
                  <span className="type-pill">{selectedDevice.type}</span>
                </span>
              </Card.Header>
              {selectedDevice.type === 'LedStripeWithSensors' && (
                <LedStripeWithSensorsDetail deviceId={selectedDevice.id} state={selectedDevice.state} />
              )}
            </Card>
          ) : null}
        </Col>
      </Row>
    );
  }

  return (
    <Row className="justify-content-center w-100 mx-0 page-enter">
      <Col xs={12} sm={11} md={9} lg={6} xl={6} className="px-0">
        <Card>
          <Card.Header className="d-flex align-items-center gap-2">
            <DevicesIcon size={20} className="text-info" />
            <strong>Devices</strong>
          </Card.Header>
          <Card.Body>
            {listError && <Alert variant="danger">{listError}</Alert>}
            {listLoading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
              </div>
            ) : devices.length === 0 ? (
              <p className="text-muted mb-0">No devices found.</p>
            ) : (
              <ListGroup variant="flush" className="mx-n2">
                {devices.map((device) => (
                  <DeviceListItem key={device.id} device={device} onSelect={setSelectedDeviceId} />
                ))}
              </ListGroup>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default DevicesPage;
