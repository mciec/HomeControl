import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { sampleService } from '../services/api';
import type { RootState } from '../store/store';

function AuthenticatedPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [protectedData, setProtectedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetProtectedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sampleService.getProtectedData();
      setProtectedData(data);
    } catch (err) {
      setError('Failed to fetch protected data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authenticated-page">
      <Row className="justify-content-center w-100">
      <Col xs={12} sm={10} md={8} lg={6} xl={6} className="px-0">
        <Card className="shadow-sm">
          <Card.Body>
            <Card.Title className="text-center mb-4">Welcome, {user?.name}!</Card.Title>
            <Card.Text className="text-center mb-3">
              <strong>Email:</strong> {user?.email}
            </Card.Text>

            <div className="d-grid gap-2 mb-4">
              <Button
                variant="success"
                size="lg"
                onClick={handleGetProtectedData}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Call Protected API'}
              </Button>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {protectedData && (
              <Card className="mt-4 bg-light">
                <Card.Body>
                  <Card.Title className="h6">API Response:</Card.Title>
                  <pre className="mb-0 api-response">
                    <code>{JSON.stringify(protectedData, null, 2)}</code>
                  </pre>
                </Card.Body>
              </Card>
            )}

            <hr className="my-4" />

            <Card.Title className="h5 mb-3">Account Information</Card.Title>
            <ul className="list-unstyled">
              <li className="mb-2">
                <strong>Status:</strong> Authenticated
              </li>
              <li className="mb-2">
                <strong>Provider:</strong> Google
              </li>
              <li>
                <strong>Last Login:</strong> {new Date().toLocaleString()}
              </li>
            </ul>
          </Card.Body>
        </Card>
      </Col>
      </Row>
    </div>
  );
}

export default AuthenticatedPage;
