#!/usr/bin/env bash
set -euo pipefail

# Ghost Web VPN — free self-hosted endpoint.
#
# Turns any Linux machine you control (home PC, mini-PC, Raspberry Pi, etc.)
# into a working Ghost Web VPN endpoint at zero cost:
#   1. Tailscale's free tier joins this machine to your private tailnet.
#   2. The SOCKS5 proxy container binds to this machine's Tailscale IP, so it
#      is only reachable by devices on your tailnet — no credentials needed,
#      no inbound ports opened, nothing exposed to the Internet.
#   3. The Ghost Web VPN browser extension connects to socks5://<IP>:1080.
#
# Usage:
#   sudo bash setup-free-endpoint.sh              # endpoint + exit node (system-wide VPN)
#   sudo bash setup-free-endpoint.sh --browser-only  # endpoint only, no exit node
#
# Chrome cannot authenticate SOCKS5 proxies, so the proxy intentionally runs
# without credentials. Security comes from binding it to the tailnet address.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$ROOT_DIR")"
EXIT_NODE=1
[[ "${1:-}" == "--browser-only" ]] && EXIT_NODE=0

if [[ $EUID -ne 0 ]]; then
  echo 'Run as root: sudo bash setup-free-endpoint.sh'
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive

echo '==> Installing Docker and Tailscale...'
apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-plugin
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

if [[ $EXIT_NODE -eq 1 ]]; then
  cat >/etc/sysctl.d/99-ghost-vpn.conf <<'EOF'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF
  sysctl --system
fi

echo '==> Starting Tailscale. Complete the login in the browser when prompted.'
if [[ $EXIT_NODE -eq 1 ]]; then
  tailscale up --advertise-exit-node
else
  tailscale up
fi

TS_IP=""
for _ in $(seq 1 15); do
  TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
  [[ -n "$TS_IP" ]] && break
  sleep 2
done
if [[ -z "$TS_IP" ]]; then
  echo 'Could not determine the Tailscale IP. Check: tailscale status'
  exit 1
fi
echo "==> Tailscale IP: $TS_IP"

ENV_FILE="$SERVER_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
SERVERURL=$TS_IP
SERVERPORT=51820
PEERS=ghost-web
PEERDNS=1.1.1.1
INTERNAL_SUBNET=10.66.66.0
PROXY_PORT=1080
PROXY_BIND=$TS_IP
PROXY_USER=
PROXY_PASSWORD=
TZ=UTC
EOF
else
  echo '==> server/.env already exists; pointing PROXY_BIND/SERVERURL at Tailscale.'
  sed -i "s|^SERVERURL=.*|SERVERURL=$TS_IP|" "$ENV_FILE"
  grep -q '^SERVERURL=' "$ENV_FILE" || echo "SERVERURL=$TS_IP" >>"$ENV_FILE"
  sed -i "s|^PROXY_BIND=.*|PROXY_BIND=$TS_IP|" "$ENV_FILE"
  grep -q '^PROXY_BIND=' "$ENV_FILE" || echo "PROXY_BIND=$TS_IP" >>"$ENV_FILE"
  sed -i "s|^PROXY_USER=.*|PROXY_USER=|" "$ENV_FILE"
  sed -i "s|^PROXY_PASSWORD=.*|PROXY_PASSWORD=|" "$ENV_FILE"
  grep -q '^PROXY_USER=' "$ENV_FILE" || echo 'PROXY_USER=' >>"$ENV_FILE"
  grep -q '^PROXY_PASSWORD=' "$ENV_FILE" || echo 'PROXY_PASSWORD=' >>"$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

cd "$SERVER_DIR"
docker compose up -d
docker compose ps

echo
echo 'Ghost Web VPN free endpoint is running.'
echo
echo 'In the Ghost Web VPN extension popup, enter:'
echo "  Protocol : socks5"
echo "  Host     : $TS_IP"
echo "  Port     : 1080"
echo '  Username : (blank)'
echo '  Password : (blank)'
echo
echo 'Verify from this machine:'
echo "  curl -x socks5h://$TS_IP:1080 -fsS https://api.ipify.org"
if [[ $EXIT_NODE -eq 1 ]]; then
  echo
  echo 'This machine also advertises itself as a Tailscale exit node for'
  echo 'system-wide VPN. Approve it in the Tailscale admin console, then select'
  echo 'it from client devices if you want ALL device traffic routed, not just'
  echo 'browser traffic.'
fi
echo
echo 'No inbound ports are open: the proxy listens only on your tailnet address.'