# HomeControl - .NET Backend with React Frontend

A full-stack application demonstrating a .NET 10 backend with vertical slice architecture and a React frontend with Redux state management, featuring Google OAuth authentication.

## Project Structure

```
HomeControl/
├── HomeControlBackEnd/          # .NET 8 ASP.NET Core API
│   ├── Features/                # Vertical slice architecture
│   │   ├── Auth/               # Authentication feature
│   │   └── Sample/             # Sample API endpoints
│   ├── Properties/
│   ├── appsettings.json
│   └── Program.cs
├── HomeControlFrontEnd/         # React + Vite frontend
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── services/           # API services
│   │   ├── store/              # Redux store
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── run-dev.ps1                  # Development mode script
├── run-prod.ps1                 # Production build script
└── README.md
```

## Prerequisites

- .NET 10 SDK
- Node.js 18+ and npm
- Windows PowerShell 5.0+
- Google OAuth credentials (for authentication)

## Setup Instructions

### 1. Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - Development: `https://localhost:3000/signin-google` and `https://localhost:7000/signin-google`
   - Production: `https://localhost:7000/signin-google`
6. Copy your Client ID and Client Secret

### 2. Configure Backend Secrets

Secrets are stored using the [.NET User Secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets) manager and are **never** committed to source control. Do not add them to `appsettings.json`.

```powershell
cd HomeControlBackEnd
dotnet user-secrets set "Google:ClientId" "YOUR_GOOGLE_CLIENT_ID"
dotnet user-secrets set "Google:ClientSecret" "YOUR_GOOGLE_CLIENT_SECRET"
```

User secrets are loaded automatically when `ASPNETCORE_ENVIRONMENT=Development` (which `run-dev.ps1` sets). For production and Docker runs, secrets are injected as environment variables by the respective scripts (`run-prod.ps1`, `test-docker.ps1`, `deploy-azure.ps1`) — they all read from the user secrets store automatically.

### 3. Install Dependencies

```powershell
# Backend dependencies are managed by .NET
# Frontend dependencies
cd HomeControlFrontEnd
npm install
```

## Running the Application

### Development Mode

```powershell
.\run-dev.ps1
```

This script will:
- Kill any existing instances of the backend and frontend
- Start the .NET backend on `https://localhost:7000`
- Start the React development server on `https://localhost:3000`
- Enable hot reload for both applications
- Proxy API requests from frontend to backend

**Access the application:**
- Frontend: https://localhost:3000
- Backend API: https://localhost:7000
- Swagger UI: https://localhost:7000/swagger

### Production Mode

```powershell
.\run-prod.ps1
```

This script will:
- Build the React frontend
- Copy the built files to the backend's `wwwroot` folder
- Build and publish the .NET backend
- Create a production-ready application

**To run the published application:**

```powershell
cd HomeControlBackEnd\bin\Release\publish
.\HomeControlBackEnd.exe
```

Access the application at: https://localhost:7000

## Features

### Backend (.NET 10)

- **Vertical Slice Architecture**: Organized by features (Auth, Sample)
- **Google OAuth Authentication**: Only allows specific email addresses
  - `michal.cieciora@gmail.com`
  - `marczibaa@gmail.com`
- **Cookie-based Sessions**: Secure, HttpOnly cookies with automatic cleanup on logout
- **CORS Support**: Configured for development and production
- **Sample Endpoints**:
  - `GET /api/sample/public` - Public endpoint (no authentication required)
  - `GET /api/sample/protected` - Protected endpoint (authentication required)
  - `GET /api/auth/status` - Check authentication status
  - `GET /api/auth/user` - Get current user info
  - `GET /api/auth/login` - Initiate Google login
  - `POST /api/auth/logout` - Logout and clear cookies

### Frontend (React + Vite)

- **Mobile-First Design**: Responsive layout with hamburger menu
- **React Bootstrap**: Professional UI components
- **Redux State Management**: Centralized authentication state
- **Vite Development Server**: Fast hot module replacement
- **API Proxy**: Development server proxies API requests to backend
- **Pages**:
  - Welcome Page: For unauthenticated users with public API demo
  - Authenticated Page: For logged-in users with protected API demo

## Authentication Flow

1. User clicks "Login with Google" button
2. Frontend redirects to backend login endpoint
3. Backend initiates Google OAuth flow
4. User authenticates with Google
5. Backend validates email against allowed list
6. Session cookie is set
7. User is redirected to frontend
8. Frontend checks authentication status and updates Redux state

## Logout Flow

1. User clicks "Logout" button
2. Frontend calls logout endpoint
3. Backend clears all cookies
4. Frontend updates Redux state
5. User is redirected to welcome page

## Development Notes

### Adding New Features

To add a new feature following vertical slice architecture:

1. Create a new folder under `HomeControlBackEnd/Features/YourFeature`
2. Add a controller: `YourFeatureController.cs`
3. Add any services or models needed for that feature
4. Register services in `Program.cs` if needed

### Frontend State Management

Redux store is configured in `src/store/store.ts`. To add new slices:

1. Create a new slice file: `src/store/yourSlice.ts`
2. Add it to the store configuration
3. Use `useSelector` and `useDispatch` hooks in components

### API Integration

API calls are centralized in `src/services/api.ts`. Add new endpoints there and use them in components.

## Troubleshooting

### Port Already in Use

If ports 3000 or 7000 are already in use:
- The dev script will attempt to kill existing processes
- Manually kill processes: `Get-Process -Name dotnet | Stop-Process -Force`
- Or change ports in `launchSettings.json` and `vite.config.ts`

### HTTPS Certificate Issues

The development environment uses self-signed certificates. You may need to:
- Trust the .NET development certificate: `dotnet dev-certs https --trust`
- Accept browser warnings about untrusted certificates

### Google OAuth Errors

- Verify secrets are set: `dotnet user-secrets list --project HomeControlBackEnd`
- Check that redirect URIs match exactly in Google Console
- Ensure allowed email addresses are configured in `AuthController.cs`

## Security Considerations

- Cookies are HttpOnly and Secure
- CORS is restricted to localhost in development
- Google OAuth validates email addresses server-side
- Session tokens are validated on each request
- All sensitive data is cleared on logout

## License

This project is provided as a sample application.
