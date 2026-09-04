# Ghost Web VPN — Quick Start

Get from a clean machine to a working private proxy in about 10 minutes. This
guide uses the **free** self-hosted endpoint (a Linux machine you already own +
Tailscale's free tier), so it costs nothing.

## What you'll have at the end

- The Ghost Web VPN extension loaded in your Chromium browser
- A free endpoint running on a machine you control
- Browser traffic routed through that endpoint, with a verified connect status

## Step 0 — What you need

- **A browser**: Chrome, Edge, Brave, or any Chromium browser (Manifest V3).
- **A Linux machine** you control (home PC, mini-PC, Raspberry Pi, an always-on
  server). This will be your endpoint. `root` or `sudo` access is required for
  the one-time setup.
- **A GitHub account** — only if you don't already have Tailscale; the setup
  script logs you in through your browser.

## Step 1 — Get the code

```sh
git clone https://github.com/TempleEU/ghost-web-vpn.git
cd ghost-web-vpn
```

## Step 2 — Load the extension

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the `ghost-web-vpn` folder you cloned.
4. Pin the extension (puzzle icon → pin 📌) so the popup is one click away.

## Step 3 — Set up the free endpoint

On the Linux machine that will be your endpoint, run:

```sh
cd ghost-web-vpn/server/free-self-hosted
sudo bash setup-free-endpoint.sh
```

The script:

1. Installs Docker and Tailscale.
2. Starts Tailscale and asks you to **log in in the browser** (one time).
3. Starts the SOCKS5 proxy, bound to the machine's **Tailscale IP only** — no
   inbound ports are opened and nothing is exposed to the Internet, so it runs
   safely without a password.
4. Prints your exact extension settings, e.g.:

```
Protocol : socks5
Host     : 100.101.102.103
Port     : 1080
Username : (blank)
Password : (blank)
```

> Tip: this machine also advertises itself as a Tailscale **exit node** by
> default. If you later want ALL device traffic (not just browser traffic)
> routed through it, approve the machine in the Tailscale admin console and
> select it from your client devices. To skip the exit node, run the script
> with `--browser-only`.

## Step 4 — Connect in the popup

1. Open the Ghost Web VPN popup.
2. Protocol: `socks5`, Host: the `100.x.y.z` address from the script,
   Port: `1080`. Leave username/password blank (Chrome can't authenticate
   SOCKS proxies — privacy comes from Tailscale, not a password).
3. Press **Connect**.

The popup runs a live connectivity check through the proxy and reports either
**"Connected — connectivity check passed"** or that the endpoint did not
respond (it retries a couple of times before giving up).

## Step 5 — Verify it's really working

On the endpoint machine:

```sh
curl -x socks5h://100.101.102.103:1080 -fsS https://api.ipify.org
```

Replace the IP with your printed Tailscale IP. If it prints the endpoint
machine's public IP, traffic is routing correctly. To double-check your browser,
visit a site like `https://whatismyipaddress.com` after connecting.

## Behavior notes

- **Auto-reconnect**: the last endpoint and "connected" state are remembered.
  When the browser restarts, the proxy is re-applied automatically — no need to
  open the popup. A background keep-alive also re-applies it if Chrome ever
  drops the proxy settings.
- **Credentials stay local**: any HTTP(S) username/password you enter is stored
  only in extension storage (`chrome.storage.local`) and is never transmitted to
  us or committed anywhere.
- **Browser traffic only**: the extension routes Chromium traffic through your
  endpoint. It is not a system-wide VPN by itself — use the Tailscale exit node
  for that.

## Disconnect or remove

- **Disconnect**: click the big power button in the popup. The proxy is cleared
  immediately.
- **Remove the extension**: uninstall it at `chrome://extensions` — that also
  clears the proxy settings.

## Don't have a spare Linux machine?

- **FOSSVPS** offers free VPSes for open-source projects:
  `sudo bash server/deploy-fossvps.sh` (see `server/README.md`).
- **Oracle Cloud free tier / Google Cloud e2-micro** always-free VMs:
  `sudo bash server/deploy-oci.sh`.
- Full endpoint docs: `server/README.md` and
  `server/free-self-hosted/README.md`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "endpoint did not respond" | Endpoint machine on? `tailscale status` there. Same tailnet as the client? Proxy container running? `docker compose -f server/docker-compose.yml ps` |
| Page loads, but still shows your real IP | Wait a few seconds for the proxy to apply, then press Connect again — the check result must say *Connected*. |
| Port 1080 already in use | Change `PROXY_PORT` in `server/.env`, re-run `docker compose up -d`, use the new port in the popup. |
| Endpoint IP changed | Re-run `setup-free-endpoint.sh`; it updates the configuration and restarts the stack. |
