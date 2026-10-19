# ByteSend SMTP Server

A lightweight, production-ready SMTP server that forwards incoming email to the ByteSend API. Deploy it standalone or behind a reverse proxy to accept SMTP connections and integrate with ByteSend's email delivery platform.

[![GitHub](https://img.shields.io/badge/GitHub-ByteSend-181717?logo=github)](https://github.com/ByteSendApp/ByteSend/tree/main/apps/smtp-server)
[![License](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)

---

## Features

- ✅ **Simple & Lightweight** — Minimal dependencies, ~10 MB Docker image
- ✅ **Flexible TLS** — `none` (behind proxy) or `manual` (standalone with certs)
- ✅ **API Key Auth** — Secure SMTP authentication using ByteSend API keys
- ✅ **Hot-Reload Certs** — Automatic certificate reload on renewal (zero downtime)
- ✅ **Multi-Port** — Listens on 25 (SMT), 587 (submission), 465 (implicit TLS)
- ✅ **Container-Ready** — Docker & Kubernetes-friendly
- ✅ **Systemd Support** — Native Linux service integration
- ✅ **Production Logs** — Structured logging via stdout/journald

---

## Quick Start

### Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/ByteSendApp/ByteSend.git
cd ByteSend/apps/smtp-server

# Configure docker-compose.yml
# (See docs/self-hosting/smtp-server.mdx for details)

# Start the server
docker compose up -d --build

# Check logs
docker compose logs -f smtp
```

### Node.js

```bash
# Clone and install
git clone https://github.com/ByteSendApp/ByteSend.git
cd ByteSend/apps/smtp-server
npm install
npm run build

# Run
NODE_ENV=production BYTESEND_BASE_URL=https://bytesend.cloud node dist/server.js
```

### Systemd

```bash
# Copy service file
sudo cp contrib/bytesend-smtp.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable bytesend-smtp
sudo systemctl start bytesend-smtp
```

---

## Configuration

Set environment variables to configure the server:

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_AUTH_USERNAME` | `bytesend` | Legacy fallback username candidate (used if the client omits username) |
| `BYTESEND_BASE_URL` | `https://bytesend.cloud` | ByteSend API endpoint (e.g., `https://api.example.com`) |
| `SMTP_TLS_MODE` | `none` | TLS mode: `none` (plain) or `manual` (with certs) |
| `SMTP_TLS_CERT_PATH` | — | Path to full certificate chain (PEM format) |
| `SMTP_TLS_KEY_PATH` | — | Path to private key (PEM format) |
| `NODE_ENV` | `development` | Set to `production` for production use |

### Example: Manual TLS with Let's Encrypt

```bash
export SMTP_TLS_MODE=manual
export SMTP_TLS_CERT_PATH=/etc/letsencrypt/live/smtp.example.com/fullchain.pem
export SMTP_TLS_KEY_PATH=/etc/letsencrypt/live/smtp.example.com/privkey.pem
node dist/server.js
```

---

## Architecture

```
┌─────────────────┐
│  SMTP Clients   │
│  (port 25/587)  │
└────────┬────────┘
         │
    [STARTTLS]
         │
         ▼
┌──────────────────────┐
│  SMTP Server         │
│  (Node.js)           │
│  - Auth              │
│  - Parse Email       │
│  - Forward to API    │
└──────────┬───────────┘
           │
           ▼
    ┌──────────────┐
    │ ByteSend API │
    │  /api/v1/... │
    └──────────────┘
```

---

## Supported Ports

- **25** — Standard SMTP (plain or STARTTLS)
- **587** — Submission port (plain or STARTTLS)
- **465** — Implicit TLS (SMTPS, manual mode only)
- **2465 & 2587** — Alternative ports for testing/internal use

## Health Checks

Monitor SMTP listener ports directly from your status page:

- `25`
- `587`
- `2587`
- `465` and `2465` when `SMTP_TLS_MODE=manual`

---

## Usage Example

### Nodemailer (Node.js)

```javascript
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.example.com",
  port: 587,
  secure: false,
  auth: {
    user: "bytesend",
    pass: "your_api_key_here",
  },
});

transporter.sendMail({
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Hello",
  text: "Email via ByteSend SMTP",
}, (err, info) => {
  console.log(err || info);
});
```

### Postfix

Add to `main.cf`:

```
relayhost = smtp.example.com:587
smtp_tls_security_level = encrypt
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
```

Then in `/etc/postfix/sasl_passwd`:

```
smtp.example.com:587  bytesend:your_api_key_here
```

---

## Deployment

### Docker Compose
See [docs/self-hosting/smtp-server.mdx](https://github.com/ByteSendApp/ByteSend/blob/main/apps/docs/self-hosting/smtp-server.mdx#option-1-docker-recommended)

### Kubernetes
See [contrib/k8s/deployment.yaml](contrib/k8s/deployment.yaml)

### Systemd
See [docs/self-hosting/smtp-server.mdx](https://github.com/ByteSendApp/ByteSend/blob/main/apps/docs/self-hosting/smtp-server.mdx#systemd-service-setup)

### Nginx Reverse Proxy
See [docs/self-hosting/smtp-server.mdx](https://github.com/ByteSendApp/ByteSend/blob/main/apps/docs/self-hosting/smtp-server.mdx#reverse-proxy-setup)

---

## Security

- **Uses AGPL v3.0** — Must share modifications
- **Authenticate with API keys** — Store keys securely, rotate regularly
- **Enable TLS in production** — Use `manual` mode with valid certificates or a reverse proxy
- **Restrict network access** — Limit port access by IP if possible
- **Monitor logs** — Watch for authentication failures and connection issues

See [SECURITY.md](SECURITY.md) for detailed security guidelines.

---

## Troubleshooting

### Connection Refused
```bash
netstat -tulpn | grep :587
telnet smtp.example.com 587
```

### Authentication Failed
- Verify the API key is correct
- Check the SMTP client username matches the team's configured SMTP username in ByteSend
- Review server logs: `docker compose logs smtp`

### STARTTLS Not Supported
- In `none` mode, STARTTLS is disabled (use a reverse proxy instead)
- In `manual` mode, ensure cert paths are valid: `openssl x509 -in /path/to/cert.pem -text`

### TLS Certificate Errors
- Verify certificate and key files exist and are readable
- Test the cert: `openssl verify /path/to/cert.pem`
- Check file permissions: `ls -la /path/to/cert.pem`

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

See [LICENSE](LICENSE) for full details.

**In short:**
- ✅ Free to use and modify
- ✅ Must share modifications
- ✅ Must include license notice
- ✅ Network use is distribution (modifications must be shared with users)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

---

## Support

- 📖 **Documentation:** [ByteSend Self-Hosting Guide](https://docs.bytesend.cloud/self-hosting/smtp-server)
- 🐛 **Issues:** [GitHub Issues](https://github.com/ByteSendApp/ByteSend/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/ByteSendApp/ByteSend/discussions)
- 📧 **Email:** [support@bytesend.cloud](mailto:support@bytesend.cloud)

---

## Acknowledgments

Built with:
- [smtp-server](https://nodemailer.com/smtp/server/) — SMTP server implementation
- [mailparser](https://nodemailer.com/extras/mailparser/) — Email parsing
- Node.js & the open source community

---

**Made with ❤️ by [NodeByte Hosting](https://nodebyte.co.uk)**
