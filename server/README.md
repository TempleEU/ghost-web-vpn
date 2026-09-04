# Ghost Web VPN endpoint

Self-hosted server side for Ghost Web VPN.

## Architecture

- **WireGuard** provides the encrypted VPN tunnel and generates the `ghost-web` peer configuration.
- **SOCKS5** runs in the WireGuard container network namespace.
- The SOCKS5 listener is exposed on TCP `1080` and requires username/password authentication.
- The browser extension can connect directly to the authenticated SOCKS5 endpoint.

LinuxServer's WireGuard image supports server mode, peer generation and configurable `SERVERURL`, `SERVERPORT`, `PEERS`, `PEERDNS`, and `INTERNAL_SUBNET`. citeturn0search0

The SOCKS5 component supports authentication through `PROXY_USER` and `PROXY_PASSWORD`. citeturn1search0

## Deploy on a VPS you control

1. Install Docker Engine and Docker Compose on a Linux VPS you own/control.
2. Copy `.env.example` to `.env`.
3. Set `SERVERURL` to the VPS public IP or DNS name.
4. Replace `PROXY_PASSWORD` with a long random secret. Never commit `.env`.
5. Open UDP `51820` and TCP `1080` in the VPS/cloud firewall.
6. Start the endpoint:

```sh
docker compose up -d
```

7. Check the service:

```sh
docker compose ps
docker compose logs --tail=100 ghost-vpn ghost-proxy
```

8. The generated WireGuard peer configuration is stored below `server/wireguard`. Keep it private.

## Client configuration

Use:

- Protocol: `socks5`
- Host: your VPS public IP/DNS name
- Port: `1080`
- Username: the `PROXY_USER` value
- Password: the `PROXY_PASSWORD` value

The browser client stores the credentials locally and supplies them when the proxy requests authentication.

## Security

This endpoint is intentionally authenticated; do **not** deploy an anonymous public SOCKS5 service. The upstream SOCKS5 implementation explicitly supports `REQUIRE_AUTH`, credentials and destination/IP allow-lists. citeturn1search0

For production, additionally restrict TCP `1080` with your VPS firewall where practical, monitor connections, rotate credentials, and keep the container images updated.

## Full-tunnel WireGuard

For a full VPN tunnel, the generated peer should use `AllowedIPs = 0.0.0.0/0`, with server forwarding/NAT configured. The LinuxServer WireGuard image documents the server-mode routing model and its `ALLOWEDIPS` setting. citeturn0search0

## Secrets rule

GitHub contains only templates. Never commit:

- `.env`
- WireGuard private keys
- generated peer `.conf` files
- proxy passwords

A real endpoint becomes operational only after this stack is deployed to a VPS/cloud server under your control.
