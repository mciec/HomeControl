import { useState } from 'react';
import axios from 'axios';
import { Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { devicesService, type LedStripeWithSensorsState, type OverrideDirection } from '../../services/devicesApi';

interface LedStripeWithSensorsDetailProps {
  deviceId: string;
  state: LedStripeWithSensorsState;
}

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function extractErrorMessage(err: unknown, direction: OverrideDirection): string {
  if (axios.isAxiosError(err) && typeof err.response?.data?.message === 'string') {
    return err.response.data.message;
  }
  return `Failed to send ${direction} override`;
}

function LedStripeWithSensorsDetail({ deviceId, state }: LedStripeWithSensorsDetailProps) {
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);

  const handleOverride = async (direction: OverrideDirection) => {
    const setLoading = direction === 'Left' ? setLeftLoading : setRightLoading;
    const setError = direction === 'Left' ? setLeftError : setRightError;

    setLoading(true);
    setError(null);
    try {
      await devicesService.sendOverride(deviceId, direction);
    } catch (err) {
      setError(extractErrorMessage(err, direction));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card.Body>
      <Row className="mb-4 gy-3">
        <Col xs={12} md={6}>
          <div className="text-muted small">Last Override Left</div>
          <div className="fs-5">{formatTimestamp(state.lastOverrideLeftReceivedUtc)}</div>
        </Col>
        <Col xs={12} md={6}>
          <div className="text-muted small">Last Override Right</div>
          <div className="fs-5">{formatTimestamp(state.lastOverrideRightReceivedUtc)}</div>
        </Col>
      </Row>

      <Row className="gy-2">
        <Col xs={12} md={6}>
          <Button
            variant="primary"
            className="w-100"
            disabled={leftLoading}
            onClick={() => handleOverride('Left')}
          >
            {leftLoading ? 'Sending...' : 'Override Left'}
          </Button>
          {leftError && (
            <Alert variant="danger" className="mt-2 mb-0">
              {leftError}
            </Alert>
          )}
        </Col>
        <Col xs={12} md={6}>
          <Button
            variant="primary"
            className="w-100"
            disabled={rightLoading}
            onClick={() => handleOverride('Right')}
          >
            {rightLoading ? 'Sending...' : 'Override Right'}
          </Button>
          {rightError && (
            <Alert variant="danger" className="mt-2 mb-0">
              {rightError}
            </Alert>
          )}
        </Col>
      </Row>
    </Card.Body>
  );
}

export default LedStripeWithSensorsDetail;
