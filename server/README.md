# Ghost Web VPN endpoint

Self-hosted server side for Ghost Web VPN.

## Architecture

- **WireGuard** provides the encrypted VPN tunnel and generates the `ghost-web`
  peer configuration.
- **SOCKS5** runs in the WireGuard container network namespace.
- Where the SOCKS5 listener binds is controlled by `PROXY_BIND` in `server/.env`:
  - `127.0.0.1` (default) — reachable only on the VPS itself, through the
    WireGuard tunnel from a native peer. This is the safest mode but the
    browser extension cannot reach it.
  - A **Tailscale IP** (`100.x.y.z`) — reachable by any device on your tailnet.
    This is the mode the Ghost Web VPN browser extension uses: encrypted hop
    over Tailscale, no public exposure, no credentials needed.

### A note on SOCKS5 credentials

Chrome **cannot authenticate SOCKS5 proxies** (its `onAuthRequired` handling
only covers HTTP/HTTPS proxies), so the browser extension always connects
without credentials. Therefore:

- If the proxy is only reachable over a private path (tailnet or WireGuard
  tunnel), leave `PROXY_USER`/`PROXY_PASSWORD` empty in `.env` — the
  `ghost-proxy` container then runs without authentication, and access control
  comes from the private network.
- If you need password-protected SOCKS5 for native clients, set the variables
  as before. Never bind an authenticated or unauthenticated SOCKS5 proxy to
  `0.0.0.0`.

The **free** way to run a working endpoint for the extension is
[`server/free-self-hosted`](free-self-hosted/): Tailscale on a machine you own,
`PROXY_BIND` set to its Tailscale IP.

## Deploy on a VPS you control

1. Install Docker Engine and Docker Compose on a Linux VPS you own/control.
2. Copy `.env.example` to `.env`.
3. Set `SERVERURL` to the VPS public IP or DNS name.
4. Replace `PROXY_PASSWORD` with a long random secret. Never commit `.env`.
5. Open UDP `51820` in the VPS/cloud firewall.
6. Start the endpoint:

```sh
docker compose up -d
```

7. Check the service:

```sh
docker compose ps
docker compose logs --tail=100 ghost-vpn ghost-proxy
```

8. Keep generated WireGuard peer configuration below `server/wireguard` private.

To point the browser extension at a VPS, join the VPS to your Tailnet
(`curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`), set
`PROXY_BIND` to the VPS Tailscale IP, leave the credentials empty, and restart
the stack.

## Security

The proxy listener is intentionally bound to a private address
(`PROXY_BIND`, default `127.0.0.1`). Do not expose an anonymous SOCKS5 service
to the Internet. If remote browser access is needed, use the WireGuard tunnel,
a Tailscale tailnet, or an authenticated, access-controlled proxy gateway.

For production, restrict firewall access, rotate credentials, update images,
and monitor the endpoint. Never commit `.env`, WireGuard private keys,
generated peer configs, or proxy passwords.

## Full-tunnel WireGuard

For a full VPN tunnel, the generated peer should use `AllowedIPs = 0.0.0.0/0`,
with server forwarding/NAT configured. Verify routing and DNS behavior before
production use.

A real endpoint becomes operational only after this stack is deployed to a
VPS/cloud server or a machine under your control.

## Contact

Questions, feedback, or support requests: [ghostweb@ghostbin.cfd](mailto:ghostweb@ghostbin.cfd)
