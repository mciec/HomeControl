# Development image for HomeControl (backend + web frontend; mobile tooling is opt-in).
# Build context is ./scripts so the setup script is the single source of truth
# for what gets installed:
#   docker build -t homecontrol-dev:ubuntu-26.04 -f docker/dev/Dockerfile scripts
# Add the JDK + Android SDK/NDK (~3 GB, needed by build-mobile-release.sh):
#   docker build --build-arg INSTALL_ANDROID=1 -t homecontrol-dev:ubuntu-26.04 -f docker/dev/Dockerfile scripts
FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1

ARG INSTALL_ANDROID=0

COPY setup-ubuntu.sh /tmp/setup-ubuntu.sh
RUN apt-get update && apt-get install -y --no-install-recommends sudo \
 && INSTALL_AZ_CLI=1 INSTALL_BROWSER_DEPS=1 INSTALL_ANDROID=${INSTALL_ANDROID} bash /tmp/setup-ubuntu.sh \
 && rm -rf /var/lib/apt/lists/* /tmp/setup-ubuntu.sh

# Non-root user (the ubuntu image ships 'ubuntu', uid 1000) with passwordless sudo.
RUN echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu \
 && chmod 0440 /etc/sudoers.d/ubuntu \
 && mkdir -p /home/src/home-control \
 && chown -R ubuntu:ubuntu /home/src

USER ubuntu
WORKDIR /home/src/home-control
CMD ["sleep", "infinity"]
