#!/usr/bin/env bash
set -euo pipefail

# Ghost Web VPN — Google Cloud Ubuntu deployment.
# Run on a Linux VM you control. No cloud credentials or private keys are stored here.
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
  if [[ -z "$SERVER_IP" ]]; then echo 'Could not determine public IPv4; set SERVERURL manually in .env.'; exit 1; fi
  sed -i "s/^SERVERURL=.*/SERVERURL=${SERVER_IP}/" .env
  chmod 600 .env
  echo 'Created server/.env with the VM public IPv4.'
  echo 'Set PROXY_USER and PROXY_PASSWORD, then run: docker compose up -d'
  exit 0
fi

chmod 600 .env
docker compose up -d
docker compose ps

echo 'Ghost Web VPN Google Cloud endpoint started.'
echo 'WireGuard peer configuration is stored privately under ./wireguard.'
