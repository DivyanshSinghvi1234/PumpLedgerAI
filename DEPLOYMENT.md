# Production Deployment & Cloud Architecture

This document maps the production architecture, hosting providers, third-party services, and configuration variables used by PumpLedgerAI. Use this as a reference when diagnosing production setups or migrating providers.

---

## 1. Production Infrastructure Map

```
┌──────────────────┐      HTTPS      ┌──────────────────┐
│  Vite Frontend   │────────────────▶│ FastAPI Backend  │
│  (Render Static) │                 │  (Render Web)    │
│  app.pumpledger  │                 │  api.pumpledger  │
└──────────────────┘                 └──────────────────┘
                                        │            │
                           PostgreSQL   │            │   S3 API (Private)
                           Connection   │            │   Presigned URL
                                        ▼            ▼
                             ┌─────────────┐      ┌─────────────┐
                             │   Neon DB   │      │  Backblaze  │
                             │ (Serverless)│      │  B2 Storage │
                             └─────────────┘      └─────────────┘
```

| Service Layer | Provider | Configuration / Pricing Mode |
|---|---|---|
| **Frontend Web Hosting** | Render | Static Site |
| **Backend API Hosting** | Render | Web Service (Python/Uvicorn) |
| **Database** | Neon | Serverless PostgreSQL (Autoscaling) |
| **Object/File Storage** | Backblaze B2 | Private Bucket (10 GB Free Tier) |
| **DNS / SSL Gateway** | Cloudflare | DNS + Proxy (SSL: Full Strict) |

---

## 2. Environment Variables Reference

### Backend Web Service (Render)

| Environment Variable | Description / Purpose | Example Value |
|---|---|---|
| **`DATABASE_URL`** | The connection string for your Neon PostgreSQL. | `postgresql://user:pass@ep-id.neon.tech/neondb?sslmode=require` |
| **`ALLOWED_ORIGINS`** | CORS authorization: URL of your deployed frontend. | `https://app.pumpledger.com` |
| **`R2_ACCOUNT_ID`** | The S3-compatible endpoint for Backblaze B2. | `s3.eu-central-003.backblazeb2.com` |
| **`R2_BUCKET_NAME`** | The name of your private storage bucket. | `PumpLedger` |
| **`R2_ACCESS_KEY_ID`** | Application Key ID from Backblaze console. | *(Get from Backblaze App Keys page)* |
| **`R2_SECRET_ACCESS_KEY`** | Secret Application Key (displayed only once). | *(Get from Backblaze App Keys page)* |
| **`R2_PUBLIC_URL`** | Keep blank for private buckets (enforces presigned secure downloads). | *(Leave empty)* |
| **`GOOGLE_API_KEY`** | API Key used for Gemini OCR invoice recognition. | *(Your Gemini API Key)* |
| **`SECRET_KEY`** | Key used to sign JWT session authentication tokens. | *(Generate a secure random string)* |

### Frontend Static Site (Render)

| Environment Variable | Description / Purpose | Example Value |
|---|---|---|
| **`VITE_API_BASE_URL`** | The base URL of your deployed backend. | `https://api.pumpledger.com` (or your backend `.onrender.com` URL) |

---

## 3. How to Migrate Providers in the Future

### A. Database (Neon → Another PostgreSQL/RDS)
1. Export your existing data:
   `pg_dump -h ep-id.neon.tech -U neondb_owner -d neondb -F c -b -v -f pumpledger_backup.dump`
2. Restore it on the new PostgreSQL server:
   `pg_restore -h new-host -U new_user -d new_db -v pumpledger_backup.dump`
3. Update the **`DATABASE_URL`** env var on your Render backend service.

### B. Storage (Backblaze B2 → Cloudflare R2 / AWS S3)
If you decide to switch from Backblaze B2 to AWS S3 or Cloudflare R2:
1. Create a new bucket on the target provider.
2. If R2 is used, verify card details on Cloudflare, enable public/private bucket settings, and generate S3 credential tokens.
3. Update these variables in Render:
   - **`R2_ACCOUNT_ID`**: Change to your Cloudflare Account ID (e.g. `abcde12345`) or S3 endpoint.
   - **`R2_BUCKET_NAME`**: Set to the new bucket name.
   - **`R2_ACCESS_KEY_ID`** & **`R2_SECRET_ACCESS_KEY`**: Provide the new credentials.
4. Old files will remain on Backblaze unless migrated using tools like `rclone`.

### C. Backend (Render → VPS / GCP Cloud VM)
The repository contains a `deploy.sh` script and a `docker-compose.yml` for self-hosted container deployments:
1. Install Docker and Docker Compose on your cloud virtual machine.
2. Clone the repository and configure your `.env` variables.
3. Run `./deploy.sh` to compile, launch, and expose the app on port `8080`.
