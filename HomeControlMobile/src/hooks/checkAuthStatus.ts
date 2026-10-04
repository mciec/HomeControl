import type { AppDispatch } from '../store/store';
import { setAuthenticated } from '../store/authSlice';
import { authService } from '../services/api';

// Shared by App.tsx (on mount) and LoginScreen (right after the WebView login
// flow completes) so both paths land on the same isAuthenticated/user state.
export async function checkAuthStatus(dispatch: AppDispatch): Promise<void> {
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
}
