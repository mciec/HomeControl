import { useState } from 'react';
import axios from 'axios';
import { Row, Col, Card } from 'react-bootstrap';
import { devicesService, type LedStripeWithSensorsState, type OverrideDirection } from '../../services/devicesApi';
import OverrideControl from './OverrideControl';

interface LedStripeWithSensorsDetailProps {
  deviceId: string;
  state: LedStripeWithSensorsState;
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
      <div className="section-label">Manual override</div>
      <Row className="gy-2">
        <Col xs={12} md={6}>
          <OverrideControl
            direction="Left"
            currentAnimation={state.currentAnimation}
            loading={leftLoading}
            error={leftError}
            onOverride={() => handleOverride('Left')}
          />
        </Col>
        <Col xs={12} md={6}>
          <OverrideControl
            direction="Right"
            currentAnimation={state.currentAnimation}
            loading={rightLoading}
            error={rightError}
            onOverride={() => handleOverride('Right')}
          />
        </Col>
      </Row>
    </Card.Body>
  );
}

export default LedStripeWithSensorsDetail;
