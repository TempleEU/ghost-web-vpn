#!/usr/bin/env bash
set -euo pipefail

# Run this on a fresh Ubuntu ARM64 OCI Always Free VM that you control.
# It installs Docker, enables IP forwarding, opens WireGuard UDP, and starts Ghost Web VPN.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ $EUID -ne 0 ]]; then echo 'Run as root (sudo -i).'; exit 1; fi

apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-plugin wireguard-tools qrencode
systemctl enable --now docker

install -d -m 700 wireguard
cat >/etc/sysctl.d/99-ghost-web-vpn.conf <<'EOF'
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
EOF
sysctl --system

if [[ ! -f .env ]]; then
  cp .env.example .env
  SERVER_IP="$(curl -4 -fsS https://api.ipify.org || true)"
  sed -i "s/^SERVERURL=.*/SERVERURL=${SERVER_IP}/" .env
  echo 'Generated server/.env. Set PROXY_USER and PROXY_PASSWORD before production use.'
  echo 'Run: nano .env && docker compose up -d'
  exit 0
fi

chmod 600 .env
docker compose up -d
docker compose ps

echo 'Ghost Web VPN endpoint started.'
echo 'WireGuard peer configuration is stored privately under ./wireguard.'
