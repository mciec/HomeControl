import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Navbar, Nav, Button, Alert, Offcanvas } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { setAuthenticated, setLoading, setError } from './store/authSlice';
import { authService } from './services/api';
import WelcomePage from './pages/WelcomePage';
import AuthenticatedPage from './pages/AuthenticatedPage';
import type { RootState } from './store/store';

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, loading, error } = useSelector((state: RootState) => state.auth);
  const [showOffcanvas, setShowOffcanvas] = useState(false);

  useEffect(() => {
    const checkAuthStatus = async () => {
      dispatch(setLoading(true));
      try {
        const status = await authService.getStatus();
        if (status.isAuthenticated) {
          const user = await authService.getUser();
          dispatch(setAuthenticated({ isAuthenticated: true, user }));
        } else {
          dispatch(setAuthenticated({ isAuthenticated: false }));
        }
      } catch (err) {
        dispatch(setAuthenticated({ isAuthenticated: false }));
      }
    };

    checkAuthStatus();
  }, [dispatch]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      dispatch(setAuthenticated({ isAuthenticated: false }));
      setShowOffcanvas(false);
    } catch (err) {
      dispatch(setError('Failed to logout'));
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar bg="dark" expand={false} sticky="top" className="navbar-dark">
        <Container>
          <Navbar.Brand href="/">HomeControl</Navbar.Brand>
          <Navbar.Toggle 
            aria-controls="offcanvasNavbar"
            onClick={() => setShowOffcanvas(true)}
          />
        </Container>
      </Navbar>

      <Offcanvas 
        show={showOffcanvas} 
        onHide={() => setShowOffcanvas(false)} 
        placement="end"
        id="offcanvasNavbar"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Menu</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="justify-content-end flex-grow-1 pe-3">
            {isAuthenticated ? (
              <Button
                variant="outline-dark"
                size="sm"
                onClick={() => {
                  handleLogout();
                  setShowOffcanvas(false);
                }}
                className="w-100"
              >
                Logout
              </Button>
            ) : (
              <Button
                variant="outline-dark"
                size="sm"
                onClick={() => {
                  authService.login();
                  setShowOffcanvas(false);
                }}
                className="w-100"
              >
                Login with Google
              </Button>
            )}
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      <Container className="flex-grow-1 py-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="text-center py-5">
            <p>Loading...</p>
          </div>
        ) : isAuthenticated ? (
          <AuthenticatedPage />
        ) : (
          <WelcomePage />
        )}
      </Container>

      <footer className="bg-dark text-light text-center py-3 mt-auto">
        <p>&copy; 2025 HomeControl. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
