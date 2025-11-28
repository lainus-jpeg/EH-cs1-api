# Fonteyn Holiday Park - Backend API

Standalone Node.js/Express backend server for the Fonteyn Holiday Park website with automated Docker deployment via GitLab CI/CD.

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Run the backend:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

The backend will start on `http://localhost:3000`

### Docker - Local Testing

1. **Build and run with docker-compose:**
   ```bash
   docker-compose up --build
   ```

2. **Or build and run manually:**
   ```bash
   docker build -f backend/Dockerfile -t fonteyn-backend .
   docker run -p 3000:3000 \
     -e DB_SERVER=case3sem2.database.windows.net \
     -e DB_USER=FonteynDB \
     -e DB_PASSWORD=Fonteyn123 \
     -e DB_NAME=fonteyndb \
     -e EMAIL_USER=your-email@gmail.com \
     -e EMAIL_PASS=your-app-password \
     fonteyn-backend
   ```

## Environment Variables

All environment variables are defined in `backend/.env`:
- `DB_USER` - Azure SQL database user
- `DB_PASSWORD` - Azure SQL database password
- `DB_SERVER` - Azure SQL server URL
- `DB_NAME` - Database name
- `PORT` - Server port (default: 3000)
- `EMAIL_USER` - Gmail account for sending newsletters
- `EMAIL_PASS` - Gmail app password
- `WEBHOOK_URL` - Discord webhook for notifications

## CI/CD Pipeline (GitLab)

The `.gitlab-ci.yml` automatically:

1. **Builds** the Docker image for the backend
2. **Pushes** to GitLab Container Registry with tags:
   - `$CI_COMMIT_SHORT_SHA` (specific commit)
   - `latest` (most recent build)
3. **Deploys** on `main` and `master` branches

### Required GitLab CI/CD Variables

Set these in GitLab Settings > CI/CD > Variables:

- `CI_REGISTRY_USER` - GitLab username
- `CI_REGISTRY_PASSWORD` - GitLab personal access token
- `DB_SERVER` - Azure SQL server
- `DB_USER` - Azure SQL user
- `DB_PASSWORD` - Azure SQL password
- `DB_NAME` - Database name
- `EMAIL_USER` - Gmail address
- `EMAIL_PASS` - Gmail app password
- `WEBHOOK_URL` - Discord webhook

### View Pipeline

1. Go to GitLab repository
2. Navigate to **CI/CD > Pipelines**
3. Click on the pipeline to see:
   - `build:backend` - Docker image build
   - `build:frontend` - Frontend build
   - `deploy:frontend` - Azure deployment
   - `deploy:backend` - Docker push confirmation

### Pull and Run Docker Image

Once pushed to registry:

```bash
docker pull registry.gitlab.com/your-group/your-project/backend:latest
docker run -p 3000:3000 \
  -e DB_SERVER=$DB_SERVER \
  -e DB_USER=$DB_USER \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=$DB_NAME \
  registry.gitlab.com/your-group/your-project/backend:latest
```

## API Endpoints

### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - User login
- `POST /v1/auth/verify-admin` - Verify admin status (Entra ID)

### Health Check
- `GET /v1/health` - API health check

### Newsletter
- `POST /v1/newsletter-signup` - Subscribe to newsletter
- `GET /v1/newsletter-emails` - Get all subscriber emails
- `POST /v1/send-newsletter` - Send newsletter to subscribers

## WebSocket Events

### Client Events
- `connection` - When a client connects
- `disconnect` - When a client disconnects

### Server Events
- `newsletter-signup` - Emitted when new user subscribes

## Database Tables

- `Users` - Registered users (Id, Name, Email, Phone, Password)
- `NewsletterEmails` - Newsletter subscribers (Id, Email, CreatedAt)

Tables are automatically created on first server startup.

## Health Check

The Docker image includes a health check that verifies the API is responding:

```bash
curl http://localhost:3000/v1/health
```

Response:
```json
{ "status": "OK" }
```

## Troubleshooting

### Docker build fails
- Ensure `backend/package.json` exists
- Check Node.js version compatibility (using Node 18)

### Container won't start
- Check environment variables are set
- Verify Azure SQL database is accessible
- View logs: `docker logs <container-id>`

### CORS errors
- Backend is configured for `http://localhost:5173` (frontend)
- Update CORS origin in `backend/app.js` if needed

