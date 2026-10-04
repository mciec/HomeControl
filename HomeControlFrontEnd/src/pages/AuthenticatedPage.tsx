import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { sampleService } from '../services/api';
import type { RootState } from '../store/store';
import { ChevronRightIcon, LedStripIcon, ShieldIcon } from '../components/icons/Icons';

interface AuthenticatedPageProps {
  onOpenDevices: () => void;
}

function AuthenticatedPage({ onOpenDevices }: AuthenticatedPageProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const [protectedData, setProtectedData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetProtectedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sampleService.getProtectedData();
      setProtectedData(data);
    } catch {
      setError('Failed to fetch protected data');
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="authenticated-page page-enter">
      <Row className="justify-content-center w-100 mx-0">
        <Col xs={12} sm={11} md={9} lg={6} xl={6} className="px-0">
          <h1 className="h3 fw-bold mb-1">Welcome back{firstName ? `, ${firstName}` : ''}</h1>
          <p className="text-secondary mb-4">Here's your home at a glance.</p>

          <Card className="mb-3">
            <button
              type="button"
              className="btn d-flex align-items-center gap-3 text-start p-3 border-0 w-100 device-row"
              onClick={onOpenDevices}
            >
              <span className="icon-tile">
                <LedStripIcon size={24} />
              </span>
              <span className="flex-grow-1">
                <strong className="d-block">Devices</strong>
                <small className="text-secondary">View status and send overrides</small>
              </span>
              <ChevronRightIcon className="device-row__chevron" />
            </button>
          </Card>

          <Card>
            <Card.Body>
              <div className="section-label">Account</div>
              <ul className="stat-list">
                <li>
                  <span>Name</span>
                  <strong>{user?.name}</strong>
                </li>
                <li>
                  <span>Email</span>
                  <strong className="text-truncate">{user?.email}</strong>
                </li>
                <li>
                  <span>Sign-in</span>
                  <strong className="d-inline-flex align-items-center gap-1">
                    <ShieldIcon size={16} className="text-success" /> Google
                  </strong>
                </li>
              </ul>

              <div className="text-center mt-3">
                <Button
                  variant="link"
                  size="sm"
                  className="text-secondary text-decoration-none"
                  onClick={handleGetProtectedData}
                  disabled={loading}
                >
                  {loading ? 'Checking...' : 'Check protected API'}
                </Button>
              </div>

              {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}

              {protectedData !== null && (
                <pre className="api-response mt-3 mb-0">
                  <code>{JSON.stringify(protectedData, null, 2)}</code>
                </pre>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default AuthenticatedPage;
