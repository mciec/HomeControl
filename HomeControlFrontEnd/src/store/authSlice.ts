import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface User {
  email: string;
  name: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAuthenticated: (state, action: PayloadAction<{ isAuthenticated: boolean; user?: User }>) => {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user || null;
      state.loading = false;
      state.error = null;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.error = null;
    },
  },
});

export const { setLoading, setAuthenticated, setError, logout } = authSlice.actions;
export default authSlice.reducer;
