import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Card, Button, Alert, ListGroup, Spinner } from 'react-bootstrap';
import type { HubConnection } from '@microsoft/signalr';
import { devicesService } from '../services/devicesApi';
import {
  createDeviceHubConnection,
  startDeviceHubConnection,
  stopDeviceHubConnection,
  subscribeToDeviceStateChanged,
  onDeviceHubReconnected,
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
} from '../store/devicesSlice';
import type { RootState } from '../store/store';
import DeviceListItem from '../components/devices/DeviceListItem';
import LedStripeWithSensorsDetail from '../components/devices/LedStripeWithSensorsDetail';

function DevicesPage() {
  const dispatch = useDispatch();
  const { devices, listLoading, listError, selectedDevice, detailLoading, detailError } = useSelector(
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
      } catch (err) {
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
      } catch (err) {
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

  const handleBack = () => {
    setSelectedDeviceId(null);
  };

  if (selectedDeviceId) {
    return (
      <Row className="justify-content-center w-100">
        <Col xs={12} sm={10} md={8} lg={6} xl={6} className="px-0">
          <Button variant="link" className="mb-3 ps-0" onClick={handleBack}>
            &larr; Back to devices
          </Button>

          {detailError && <Alert variant="danger">{detailError}</Alert>}

          {detailLoading && !selectedDevice ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : selectedDevice ? (
            <Card className="shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <strong>{selectedDevice.name}</strong>
                <span className="text-muted small">{selectedDevice.type}</span>
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
    <Row className="justify-content-center w-100">
      <Col xs={12} sm={10} md={8} lg={6} xl={6} className="px-0">
        <Card className="shadow-sm">
          <Card.Header>
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
              <ListGroup variant="flush">
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
