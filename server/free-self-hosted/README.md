# Free self-hosted endpoint

The simplest genuinely free endpoint is a Linux machine you already control: a
home PC, mini-PC, Raspberry Pi, or any other always-on Linux host. This setup
uses Tailscale's free tier and makes that machine a working Ghost Web VPN
endpoint — with no VPS rental, no cloud account, and no inbound ports to open.

## How it works

- **Tailscale** (free tier) joins your machine to a private tailnet and gives it
  a stable 100.x.y.z address. Traffic between your browser and this machine is
  encrypted by Tailscale.
- A **SOCKS5 proxy container** binds to that Tailscale address on port 1080, so
  it is only reachable by devices on your own tailnet. Nothing is exposed to the
  public Internet, which is why it safely runs **without a password**.
- The **Ghost Web VPN browser extension** connects to `socks5://<IP>:1080` and
  routes your browser traffic out through the machine's own Internet
  connection. The extension verifies the connection when you press Connect, so
  you get a real connected/unreachable status instead of silent failure.
- Optionally (the default), the script also advertises the machine as a
  **Tailscale exit node**, so client devices can additionally route *all* of
  their traffic — not just browser traffic — through it.

> Chrome cannot authenticate SOCKS5 proxies, so the extension never sends
> credentials. Never bind this proxy to `0.0.0.0` or a public address.

## Setup

On the Linux machine, run:

```sh
git clone <this repository> && cd ghost-web-vpn/server/free-self-hosted
sudo bash setup-free-endpoint.sh
```

- Complete the interactive Tailscale login when prompted.
- If you only want the browser endpoint (no system-wide exit node), pass
  `--browser-only`.
- If you use the exit node, approve the machine in the Tailscale admin console,
  then select it from your client devices.

When the script finishes it prints the exact extension settings. In the Ghost
Web VPN popup enter:

| Field    | Value                        |
| -------- | ---------------------------- |
| Protocol | `socks5`                     |
| Host     | the printed `100.x.y.z` IP   |
| Port     | `1080`                       |
| Username | *(blank)*                    |
| Password | *(blank)*                    |

Press **Connect**. The popup performs a live connectivity check and reports
either "Connected — traffic is routed through your endpoint" or that the
endpoint is unreachable.

## Verify

From the endpoint machine:

```sh
curl -x socks5h://<tailscale-ip>:1080 -fsS https://api.ipify.org
```

From another device on your tailnet (the one running the browser), install
Tailscale, log in to the same tailnet, then run the same `curl` command against
the endpoint's IP. If it prints the endpoint machine's public IP, browser
traffic will route correctly.

## Trade-offs

This is not a cloud-hosted VPN. If the home machine is offline, the endpoint is
offline. Upload bandwidth and ISP terms determine performance, and the machine's
public IP is the one websites will see.

## Troubleshooting

- **Connection fails in the popup** — confirm the endpoint machine is on and
  connected to Tailscale (`tailscale status`), and that the client device is on
  the same tailnet. On the endpoint run `docker compose -f server/docker-compose.yml ps` and
  `docker compose -f server/docker-compose.yml logs ghost-proxy`.
- **Port 1080 is already in use** — change `PROXY_PORT` in `server/.env` and
  re-run `docker compose up -d`, then use the new port in the popup.
- **You changed the machine's IP** — re-run the setup script; it updates
  `server/.env` and restarts the stack.

## Alternatives

- **FOSSVPS** — a free VPS for open-source projects (`server/deploy-fossvps.sh`).
- **Oracle Cloud free tier / Google Cloud e2-micro** — always-free VMs
  (`server/deploy-oci.sh`); see the main server README.
- **Headscale** — an open-source, self-hosted control server compatible with
  Tailscale clients, for when you run your own coordination server.

## Contact

Questions, feedback, or support requests: [ghostweb@ghostbin.cfd](mailto:ghostweb@ghostbin.cfd)
