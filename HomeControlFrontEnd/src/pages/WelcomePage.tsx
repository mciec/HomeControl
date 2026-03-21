import { useState } from 'react';
import { Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { sampleService } from '../services/api';

function WelcomePage() {
  const [publicData, setPublicData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetPublicData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sampleService.getPublicData();
      setPublicData(data);
    } catch (err) {
      setError('Failed to fetch public data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="welcome-page">
      <Row className="justify-content-center w-100">
      <Col xs={12} sm={10} md={8} lg={6} xl={6} className="px-0">
        <Card className="shadow-sm">
          <Card.Body>
            <Card.Title className="text-center mb-4">Welcome to HomeControl</Card.Title>
            <Card.Text className="text-center mb-4">
              This is a sample application demonstrating authentication with Google and API integration.
            </Card.Text>

            <div className="d-grid gap-2 mb-4">
              <Button
                variant="primary"
                size="lg"
                onClick={handleGetPublicData}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Call Public API'}
              </Button>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {publicData && (
              <Card className="mt-4 bg-light">
                <Card.Body>
                  <Card.Title className="h6">API Response:</Card.Title>
                  <pre className="mb-0 api-response">
                    <code>{JSON.stringify(publicData, null, 2)}</code>
                  </pre>
                </Card.Body>
              </Card>
            )}

            <div className="mt-4 text-center text-muted">
              <small>
                To access protected features, please log in using the button in the top navigation.
              </small>
            </div>
          </Card.Body>
        </Card>
      </Col>
      </Row>
    </div>
  );
}

export default WelcomePage;
