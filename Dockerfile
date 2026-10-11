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

# HomeControlBackEnd.csproj has a ProjectReference to ../Shared/MqttManager,
# which resolves (relative to WORKDIR /app/backend) to /app/Shared/MqttManager -
# must exist before restore/publish or both fail with CS0246 "MqttManager
# could not be found".
COPY Shared/ /app/Shared/

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

# Build stage for the embedded MQTT broker (Eclipse Mosquitto, source in ThirdParty/mosquitto).
# Built on the runtime base image so libc/OpenSSL match exactly what it will run on. Only what the
# deployment needs is built: the broker, the password tool, the pub/sub clients (for diagnostics) and
# the password-file / ACL-file auth plugins - no docs, tests, HTTP API or other plugins.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS mosquitto-build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake libssl-dev libcjson-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ThirdParty/mosquitto /src/mosquitto
RUN cmake -S /src/mosquitto -B /build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr \
        -DWITH_TESTS=OFF -DWITH_DOCS=OFF -DWITH_HTTP_API=OFF -DWITH_CTRL_SHELL=OFF -DWITH_SRV=OFF \
        -DWITH_PLUGIN_DYNAMIC_SECURITY=OFF -DWITH_PLUGIN_EXAMPLES=OFF \
        -DWITH_PLUGIN_PERSIST_SQLITE=OFF -DWITH_PLUGIN_SPARKPLUG_AWARE=OFF \
    && cmake --build /build -j"$(nproc)" \
    && DESTDIR=/out cmake --install /build --strip \
    && rm -rf /out/usr/include /out/usr/etc /out/usr/lib/*/pkgconfig \
    && mkdir -p /out/usr/lib/mosquitto \
    && mv /out/usr/lib/*/mosquitto_*.so /out/usr/lib/mosquitto/

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

# Mosquitto's only runtime dependency beyond what the base image has (OpenSSL, zlib) is cJSON.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libcjson1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system mosquitto \
    && useradd --system --gid mosquitto --no-create-home --shell /usr/sbin/nologin mosquitto
COPY --from=mosquitto-build /out/usr/ /usr/
COPY Broker/mosquitto.conf Broker/aclfile /etc/mosquitto/
COPY Broker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

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

# Starts the embedded broker (when BROKER_*_PASSWORD are provided) and then the backend.
ENTRYPOINT ["/entrypoint.sh"]
