# Quick Setup Guide

## Step 1: Get Google OAuth Credentials

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Web Application
5. Add these Authorized redirect URIs:
   - `https://localhost:7000/signin-google`
   - `https://localhost:3000/signin-google` (for development)
6. Copy your **Client ID** and **Client Secret**

## Step 2: Configure the Backend

Edit `HomeControlBackEnd/appsettings.json` and add your credentials:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Google": {
    "ClientId": "YOUR_CLIENT_ID_HERE",
    "ClientSecret": "YOUR_CLIENT_SECRET_HERE"
  }
}
```

## Step 3: Trust the Development Certificate (Windows)

```powershell
dotnet dev-certs https --trust
```

## Step 4: Run in Development Mode

```powershell
.\run-dev.ps1
```

The script will:
- Kill any existing processes
- Start the backend on `https://localhost:7000`
- Start the frontend on `https://localhost:3000`

## Step 5: Test the Application

1. Open https://localhost:3000 in your browser
2. Click "Call Public API" to test the public endpoint
3. Click "Login with Google" to authenticate
4. After login, click "Call Protected API" to test the protected endpoint
5. Click "Logout" to test the logout functionality

## Allowed Email Addresses

Only these email addresses can log in:
- `michal.cieciora@gmail.com`
- `marczibaa@gmail.com`

To add more, edit `HomeControlBackEnd/Features/Auth/AuthController.cs` and update the `AllowedEmails` set.

## Production Build

To build for production:

```powershell
.\run-prod.ps1
```

This will:
- Build the React frontend
- Copy it to the backend's wwwroot folder
- Build and publish the .NET backend
- Create a production-ready application in `HomeControlBackEnd/bin/Release/publish`

## Troubleshooting

### Ports Already in Use
The dev script tries to kill existing processes. If that fails:
```powershell
Get-Process -Name dotnet | Stop-Process -Force
Get-Process -Name node | Stop-Process -Force
```

### Certificate Issues
If you get certificate warnings:
```powershell
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

### Google Login Not Working
- Verify Client ID and Secret are correct
- Check that redirect URIs match exactly in Google Console
- Make sure you're using an allowed email address
- Check browser console for errors

## Project Structure

```
HomeControl/
├── HomeControlBackEnd/          # .NET 8 API
│   ├── Features/
│   │   ├── Auth/               # Authentication
│   │   └── Sample/             # Sample endpoints
│   └── Program.cs
├── HomeControlFrontEnd/         # React + Vite
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── store/
│   │   └── App.tsx
├── run-dev.ps1                  # Development script
├── run-prod.ps1                 # Production build script
└── README.md
```

## Key Features

✅ Google OAuth Authentication
✅ Vertical Slice Architecture (Backend)
✅ Redux State Management (Frontend)
✅ React Bootstrap UI
✅ Mobile-First Design
✅ Development & Production Modes
✅ Hot Module Replacement (Development)
✅ API Proxy (Development)
✅ Secure Cookie Sessions
✅ CORS Support

## API Endpoints

### Public
- `GET /api/sample/public` - Public data (no auth required)

### Protected (Requires Authentication)
- `GET /api/sample/protected` - Protected data
- `GET /api/auth/user` - Get current user info
- `POST /api/auth/logout` - Logout

### Authentication
- `GET /api/auth/login` - Start Google login
- `GET /api/auth/status` - Check auth status
- `GET /signin-google` - Google callback (automatic)

## Next Steps

1. Customize the UI in `HomeControlFrontEnd/src/pages/`
2. Add new API endpoints in `HomeControlBackEnd/Features/`
3. Extend Redux store in `HomeControlFrontEnd/src/store/`
4. Add more allowed email addresses as needed

For more details, see [README.md](README.md)
