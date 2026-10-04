import { useState } from 'react';
import { Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { authService, sampleService } from '../services/api';
import { BoltIcon, GoogleIcon, LogoMark, PulseIcon, ShieldIcon } from '../components/icons/Icons';

function WelcomePage() {
  const [publicData, setPublicData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetPublicData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sampleService.getPublicData();
      setPublicData(data);
    } catch {
      setError('Failed to fetch public data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="welcome-page page-enter">
      <Row className="justify-content-center w-100 mx-0">
        <Col xs={12} sm={11} md={9} lg={6} xl={6} className="px-0">
          <Card>
            <Card.Body className="p-4 p-md-5">
              <div className="hero">
                <div className="hero__logo">
                  <LogoMark size={64} />
                </div>
                <h1 className="hero__title">
                  Your home, <span>under control</span>
                </h1>
                <p className="hero__lead">
                  Monitor and command your connected devices from anywhere - live status, instant overrides, one secure sign-in.
                </p>

                <div className="d-grid gap-2 col-12 col-sm-8 mx-auto">
                  <Button className="btn-google btn-lg" onClick={() => authService.login()}>
                    <GoogleIcon size={22} /> Sign in with Google
                  </Button>
                </div>
              </div>

              <div className="feature-grid">
                <div className="feature">
                  <PulseIcon className="feature__icon" size={22} />
                  <strong>Live status</strong>
                  <span>Animations and events update in real time.</span>
                </div>
                <div className="feature">
                  <BoltIcon className="feature__icon" size={22} />
                  <strong>Instant control</strong>
                  <span>Override a device with a single tap.</span>
                </div>
                <div className="feature">
                  <ShieldIcon className="feature__icon" size={22} />
                  <strong>Private</strong>
                  <span>Access limited to approved Google accounts.</span>
                </div>
              </div>

              <div className="text-center mt-4">
                <Button variant="link" size="sm" className="text-secondary text-decoration-none" onClick={handleGetPublicData} disabled={loading}>
                  {loading ? 'Checking...' : 'Check API status'}
                </Button>
              </div>

              {error && <Alert variant="danger" className="mt-3 mb-0">{error}</Alert>}

              {publicData !== null && (
                <pre className="api-response mt-3 mb-0">
                  <code>{JSON.stringify(publicData, null, 2)}</code>
                </pre>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default WelcomePage;
