# Build stage for frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY HomeControlFrontEnd/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY HomeControlFrontEnd/ ./

# Build frontend
RUN npm run build

# Build stage for backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build

WORKDIR /app/backend

# Copy backend project files
COPY HomeControlBackEnd/*.csproj ./

# Restore dependencies
RUN dotnet restore

# Copy backend source
COPY HomeControlBackEnd/ ./

# Copy frontend build output to wwwroot
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# Build and publish backend
RUN dotnet publish -c Release -o /app/publish

# Generate development certificate in the SDK stage
RUN dotnet dev-certs https -ep /app/aspnetapp.pfx -p YourSecurePassword123! && chmod 644 /app/aspnetapp.pfx

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

# Copy published application
COPY --from=backend-build /app/publish ./

# Copy certificate from build stage
COPY --from=backend-build /app/aspnetapp.pfx /app/aspnetapp.pfx

# Expose ports
EXPOSE 8080
EXPOSE 8081

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080;https://+:8081
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_Kestrel__Certificates__Default__Password=YourSecurePassword123!
ENV ASPNETCORE_Kestrel__Certificates__Default__Path=/app/aspnetapp.pfx

# Run the application
ENTRYPOINT ["dotnet", "HomeControlBackEnd.dll"]
