import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Navbar, Nav, Alert, Offcanvas, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { setAuthenticated, setLoading, setError } from './store/authSlice';
import { authService } from './services/api';
import WelcomePage from './pages/WelcomePage';
import AuthenticatedPage from './pages/AuthenticatedPage';
import DevicesPage from './pages/DevicesPage';
import Background from './components/Background';
import { DevicesIcon, GoogleIcon, HomeIcon, LogoMark, LogoutIcon, MenuIcon } from './components/icons/Icons';
import type { RootState } from './store/store';

type ActiveView = 'home' | 'devices';

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, loading, error, user } = useSelector((state: RootState) => state.auth);
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('home');

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
      } catch {
        dispatch(setAuthenticated({ isAuthenticated: false }));
      }
    };

    checkAuthStatus();
  }, [dispatch]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      dispatch(setAuthenticated({ isAuthenticated: false }));
      setActiveView('home');
      setShowOffcanvas(false);
    } catch {
      dispatch(setError('Failed to logout'));
    }
  };

  const goTo = (view: ActiveView) => {
    setActiveView(view);
    setShowOffcanvas(false);
  };

  const initial = (user?.name ?? user?.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="d-flex flex-column min-vh-100">
      <Background />

      <Navbar expand={false} sticky="top" className="app-navbar py-2">
        <Container className="d-flex align-items-center justify-content-between">
          <Navbar.Brand href="/" className="brand m-0">
            <LogoMark size={34} className="brand__mark" />
            <span className="brand__name">
              Home<span>Control</span>
            </span>
          </Navbar.Brand>

          <div className="d-flex align-items-center gap-2">
            {isAuthenticated && user && (
              <span className="nav-chip d-none d-sm-inline-flex" title={user.email}>
                <span className="nav-chip__avatar icon-tile icon-tile--sm fw-bold" style={{ width: '1.7rem', height: '1.7rem' }}>
                  {initial}
                </span>
                <span className="text-truncate">{user.name}</span>
              </span>
            )}
            <button
              type="button"
              className="menu-toggle"
              aria-label="Open menu"
              aria-controls="offcanvasNavbar"
              aria-expanded={showOffcanvas}
              onClick={() => setShowOffcanvas(true)}
            >
              <MenuIcon size={22} />
            </button>
          </div>
        </Container>
      </Navbar>

      <Offcanvas
        show={showOffcanvas}
        onHide={() => setShowOffcanvas(false)}
        placement="end"
        id="offcanvasNavbar"
        className="app-menu"
      >
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title className="d-flex align-items-center gap-2">
            <LogoMark size={26} />
            Menu
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className={`menu-item btn ${activeView === 'home' ? 'is-active' : ''}`}
                  onClick={() => goTo('home')}
                >
                  <HomeIcon /> Home
                </button>
                <button
                  type="button"
                  className={`menu-item btn ${activeView === 'devices' ? 'is-active' : ''}`}
                  onClick={() => goTo('devices')}
                >
                  <DevicesIcon /> Devices
                </button>
                <hr className="border-secondary-subtle my-3" />
                <button
                  type="button"
                  className="menu-item menu-item--danger btn"
                  onClick={() => {
                    handleLogout();
                    setShowOffcanvas(false);
                  }}
                >
                  <LogoutIcon /> Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-google py-2"
                onClick={() => {
                  authService.login();
                  setShowOffcanvas(false);
                }}
              >
                <GoogleIcon /> Sign in with Google
              </button>
            )}
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      <Container className="flex-grow-1 py-4 py-md-5">
        {error && <Alert variant="danger">{error}</Alert>}
        {loading ? (
          <div className="text-center py-5 text-secondary">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading...
          </div>
        ) : isAuthenticated ? (
          activeView === 'devices' ? (
            <DevicesPage />
          ) : (
            <AuthenticatedPage onOpenDevices={() => setActiveView('devices')} />
          )
        ) : (
          <WelcomePage />
        )}
      </Container>

      <footer className="text-center py-3 mt-auto">
        <small>&copy; {new Date().getFullYear()} HomeControl</small>
      </footer>
    </div>
  );
}

export default App;
