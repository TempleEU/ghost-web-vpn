# Free self-hosted endpoint

If Oracle Cloud is unavailable, the simplest genuinely free option is to use a Linux machine you already control as the Ghost endpoint. This can be a home PC, mini-PC, Raspberry Pi, or another always-on Linux host.

This setup uses Tailscale's WireGuard-based networking and configures the Linux host as an **exit node**, which routes the client's Internet traffic through that machine. Tailscale documents exit nodes as the VPN-server-like feature for routing outbound Internet traffic. 

## Setup

Run on the Linux host:

```sh
sudo bash tailscale-exit-node.sh
```

Then approve the machine as an exit node in the Tailscale admin console and select it on the client. The host must remain powered on and connected to the Internet.

## Why this replaces the VPS

- No VPS rental required.
- No Oracle/Azure/GCP availability dependency.
- Uses a machine and Internet connection you already own/control.
- Tailscale provides NAT traversal, so inbound port forwarding is usually unnecessary.
- Exit-node traffic appears on the Internet as coming from the exit-node's connection.

## Trade-offs

This is not a cloud-hosted VPN. If the home machine is offline, the endpoint is offline. Upload bandwidth and ISP terms also determine performance.

For Ghost Web VPN's browser extension, a future native client integration should select the Tailscale exit node rather than treating the browser extension itself as a full system VPN. Chromium's proxy API alone cannot turn a browser extension into a system-wide VPN.

## Open-source alternative

If you later obtain any small server, Headscale is an open-source, self-hosted control server compatible with Tailscale clients and designed for personal/small-organization deployments. It can advertise exit nodes and supports Android, iOS, Windows, macOS and Linux clients through the Tailscale ecosystem.
