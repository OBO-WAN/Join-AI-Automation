# Production Backend Operations

The production automation backend runs independently of the developer machine on a Netcup VPS. The frontend talks to Firebase directly and uses the public n8n webhook for status-change notifications.

## Architecture

```text
Frontend
  │
  ├── Firebase Realtime Database
  │
  └── HTTPS webhook
          │
          ▼
   Cloudflare Tunnel
          │
          ▼
   n8n on Netcup VPS
          │
          ├── Firebase
          ├── IMAP
          ├── SMTP
          └── Google Gemini
```

The developer machine is not part of the production runtime.

## Server access

SSH password authentication and root SSH login are disabled. Use the dedicated SSH key from the local development machine:

```bash
ssh -i <SSH_KEY> <SSH_USER>@<VPS_IP>
```

Do not commit private keys, passwords, Cloudflare tunnel credentials, n8n credentials, or backup archives containing n8n data.

## n8n

n8n runs with Docker Compose from:

```text
~/n8n-server/compose.yml
```

The production image is currently pinned to:

```text
docker.n8n.io/n8nio/n8n:2.36.8
```

Persistent n8n state is stored in the external Docker volume:

```text
n8n_data
```

Port `5678` is bound only to loopback:

```text
127.0.0.1:5678
```

It must not be exposed directly to the public internet.

### Check n8n

```bash
cd ~/n8n-server
sudo docker compose ps
sudo docker logs --tail 100 n8n
curl -I http://127.0.0.1:5678/
```

Expected local HTTP response: `200 OK`.

### Restart n8n

```bash
cd ~/n8n-server
sudo docker compose restart
```

The container uses `restart: unless-stopped`, so it starts automatically after a VPS reboot.

## n8n UI access

The editor UI is intentionally not public. Open an SSH tunnel from the local development machine:

```bash
ssh -i <SSH_KEY> \
  -L 5679:127.0.0.1:5678 \
  <SSH_USER>@<VPS_IP>
```

Then open:

```text
http://localhost:5679
```

The SSH tunnel is only needed for administration. Production workflows continue running without it.

## Cloudflare Tunnel

Cloudflare Tunnel runs as a systemd service and forwards only the production webhook path to n8n:

```text
https://n8n.naranjo.io/webhook/task-status-changed
        ↓
http://127.0.0.1:5678
```

Configuration:

```text
/etc/cloudflared/config.yml
```

Check the service:

```bash
systemctl is-active cloudflared
sudo journalctl -u cloudflared -n 100 --no-pager
```

Restart it with:

```bash
sudo systemctl restart cloudflared
```

The root URL `https://n8n.naranjo.io/` intentionally returns `404`; only the required webhook route is exposed.

## Firewall

UFW denies incoming traffic by default and allows SSH. n8n port `5678` must remain closed publicly because Cloudflare Tunnel connects outbound to the local service.

Check the firewall:

```bash
sudo ufw status verbose
```

The provider-level default outbound mail-block policy was removed so n8n can reach the authenticated SMTP service. Do not disable the VPS firewall to solve mail problems.

## Active production workflows

The important active workflows are:

- `Task Status Notifications`
- `Email Intake - AI Analysis (new ETag)`

For status notifications, the intended order is:

```text
Webhook
→ Get Firebase Task
→ Valid External Task?
→ Send an Email
→ Mark Status Notification Sent
```

The Firebase notification marker is written only after the email node succeeds. This prevents a failed mail attempt from being recorded as already notified.

Workflow exports are stored in:

```text
n8n/workflows/
```

After changing a production workflow, export the current n8n version and update the corresponding JSON file in the repository.

## Quick reboot health check

After a VPS reboot:

```bash
sudo systemctl is-active docker
sudo docker ps --filter name=n8n
systemctl is-active cloudflared
curl -I http://127.0.0.1:5678/
```

Expected state:

```text
Docker: active
n8n: Up
cloudflared: active
n8n localhost: HTTP 200
```

Then test the external route from another machine:

```bash
curl -i https://n8n.naranjo.io/
```

Expected result: HTTP `404` on the root path.

The final functional check is to move an external task and verify that `Task Status Notifications` succeeds and the external creator receives the email.

## Backup and restore

Treat n8n backups as sensitive because they contain workflow state and encrypted credentials together with the encryption configuration.

To create a consistent manual backup, stop n8n first:

```bash
cd ~/n8n-server
sudo docker compose stop
mkdir -p ~/n8n-backup
sudo docker run --rm \
  -v n8n_data:/data:ro \
  -v ~/n8n-backup:/backup \
  alpine \
  tar czf /backup/n8n_data_backup.tar.gz -C /data .
sudo docker compose start
```

Keep at least one backup outside the VPS. Do not commit backup archives to Git.

To restore, stop n8n, restore the archive into an empty `n8n_data` volume, and start the Compose service again. Verify the UI, both active workflows, SMTP connectivity, and one end-to-end status notification after restoration.

## Local fallback copy

The former local n8n installation may be retained temporarily as a rollback copy, but it must stay stopped while the VPS is production. Running both instances can cause duplicate IMAP processing and duplicate automations.

Once the VPS backup strategy has been verified, old local/server migration archives can be removed securely.