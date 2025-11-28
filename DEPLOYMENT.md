# Fonteyn Holiday Park - Backend Repository

**Standalone Node.js/Express backend API** with Docker support and GitLab CI/CD for automated deployment.

## 📋 Project Structure

```
backend/
├── app.js              # Main application
├── package.json        # Dependencies
├── package-lock.json   # Locked versions
├── .env               # Environment variables
├── Dockerfile         # Docker build configuration
├── .dockerignore       # Files excluded from Docker
├── docker-compose.yml # Local Docker testing
├── .gitlab-ci.yml     # GitLab CI/CD pipeline
└── README.md          # This file
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Run the server
npm start

# Or with auto-reload (requires nodemon)
npm run dev
```

Backend runs on: `http://localhost:3000`

### Docker Locally

```bash
# Build and run with docker-compose
docker-compose up --build

# Or manually build and run
docker build -t fonteyn-backend .
docker run -p 3000:3000 \
  -e DB_SERVER=your-server.database.windows.net \
  -e DB_USER=your-user \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=your-database \
  fonteyn-backend
```

## 🔧 Environment Variables

Create a `.env` file in the backend directory:

```env
# Database Configuration
DB_SERVER=case3sem2.database.windows.net
DB_USER=FonteynDB
DB_PASSWORD=Fonteyn123
DB_NAME=fonteyndb

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Webhooks
WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url

# Server
PORT=3000
```

## 📦 Docker

### Build Image

```bash
docker build -t fonteyn-backend:latest .
```

### Run Container

```bash
docker run -d \
  --name fonteyn-backend \
  -p 3000:3000 \
  -e DB_SERVER=$DB_SERVER \
  -e DB_USER=$DB_USER \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=$DB_NAME \
  -e EMAIL_USER=$EMAIL_USER \
  -e EMAIL_PASS=$EMAIL_PASS \
  -e WEBHOOK_URL=$WEBHOOK_URL \
  fonteyn-backend:latest
```

### Check Health

```bash
curl http://localhost:3000/v1/health
```

Expected response:
```json
{ "status": "OK" }
```

## 🔄 GitLab CI/CD Pipeline

The `.gitlab-ci.yml` file automatically:

1. **Build Stage**: Builds Docker image and pushes to GitLab Container Registry
2. **Deploy Stage**: Confirms deployment and displays pull instructions

### Setup GitLab CI/CD Variables

In GitLab repository, go to **Settings > CI/CD > Variables** and add:

```
CI_REGISTRY_USER = your-gitlab-username
CI_REGISTRY_PASSWORD = your-gitlab-personal-access-token
DB_SERVER = your-database-server
DB_USER = your-database-user
DB_PASSWORD = your-database-password
DB_NAME = your-database-name
EMAIL_USER = your-email@gmail.com
EMAIL_PASS = your-app-password
WEBHOOK_URL = your-discord-webhook-url
```

### Pipeline Workflow

1. Push to `main` or `master` branch
2. GitLab CI/CD automatically:
   - Builds Docker image
   - Tags with commit SHA and `latest`
   - Pushes to GitLab Container Registry
   - Displays pull instructions

### View Pipeline

```
GitLab > CI/CD > Pipelines > Click pipeline > View jobs
```

### Pull from Registry

```bash
docker pull registry.gitlab.com/your-group/your-project:latest
```

## 🔌 API Endpoints

### Authentication
- `POST /v1/auth/register` - Register new user
- `POST /v1/auth/login` - User login
- `POST /v1/auth/verify-admin` - Verify admin status

### Newsletter
- `POST /v1/newsletter-signup` - Subscribe to newsletter
- `GET /v1/newsletter-emails` - Get all subscribers
- `POST /v1/send-newsletter` - Send newsletter

### Health
- `GET /v1/health` - Health check

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE Users (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(255) NOT NULL,
  Email NVARCHAR(255) NOT NULL UNIQUE,
  Phone NVARCHAR(20),
  Password NVARCHAR(255) NOT NULL
);
```

### NewsletterEmails Table
```sql
CREATE TABLE NewsletterEmails (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Email NVARCHAR(255) NOT NULL UNIQUE,
  CreatedAt DATETIME DEFAULT GETDATE()
);
```

Tables are auto-created on first server startup.

## 🐛 Troubleshooting

### Docker build fails
- Check Docker daemon is running
- Verify `package.json` exists
- Check Node.js version in Dockerfile

### Container won't start
- Check all environment variables are set
- Verify database connectivity
- Check logs: `docker logs <container-id>`

### CORS errors
- Update `origin` in `app.js` CORS config
- Default: `http://localhost:5173`

### Database connection fails
- Verify Azure SQL credentials
- Check firewall allows your IP
- Ensure database exists

## 📚 References

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/)

## 👥 Support

For issues or questions:
1. Check logs: `docker logs <container-id>`
2. Review CI/CD pipeline: GitLab > CI/CD > Pipelines
3. Check database connectivity
4. Verify all environment variables are set
