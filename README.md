# 🚀 SaaS Recruitment & Vendor Management Platform

A comprehensive recruitment platform with AI-powered candidate matching, role-based access control, and trust point gamification system.

## ✨ Features

- **Multi-Role Dashboard**: System Admin, Client Admin, and Recruiter interfaces
- **AI-Powered Matching**: Resume/LinkedIn profile analysis with OpenAI integration
- **Trust Points System**: Gamified recruiter performance tracking
- **Real-time Updates**: WebSocket integration for live notifications
- **Document Processing**: PDF resume parsing and LinkedIn profile extraction
- **Advanced Analytics**: Comprehensive reporting and insights

## 🏗️ Architecture

- **Backend**: Node.js + Express.js + MongoDB
- **Frontend**: React.js + Tailwind CSS
- **AI Service**: OpenAI GPT integration
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based with RBAC
- **Containerization**: Docker + Docker Compose

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- OpenAI API Key

### 1. Clone Repository

```bash
git clone https://github.com/your-org/recruitment-platform.git
cd recruitment-platform
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start with Docker

```bash
# Build and start all services
docker-compose up --build

# Or start in background
docker-compose up -d
```

### 4. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- AI Service: http://localhost:5001

### 5. Default Credentials

```
System Admin:
Email: admin@platform.com
Password: admin123

Client Admin:
Email: client@company.com
Password: client123

Recruiter:
Email: recruiter@platform.com
Password: recruiter123
```

## 🛠️ Development Setup

### Local Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start

# AI Service
cd ai-service
npm install
npm run dev
```

### Database Seeding

```bash
# Seed with sample data
cd backend
npm run seed
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Requirements
- `GET /api/requirements` - List requirements
- `POST /api/requirements` - Create requirement
- `PUT /api/requirements/:id` - Update requirement
- `DELETE /api/requirements/:id` - Delete requirement

### Submissions
- `GET /api/submissions` - List submissions
- `POST /api/submissions` - Submit candidate
- `PUT /api/submissions/:id/status` - Update status

### AI Analysis
- `POST /api/ai/analyze-candidate` - Analyze candidate match
- `POST /api/ai/parse-resume` - Parse PDF resume
- `POST /api/ai/parse-linkedin` - Parse LinkedIn profile

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/recruitment` |
| `JWT_SECRET` | JWT signing secret | Required |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

### Trust Points System

| Action | Points | Description |
|--------|---------|-------------|
| Submission | +5 | Submit candidate |
| Interview | +15 | Candidate reaches interview |
| Final Round | +25 | Candidate reaches final |
| Placement | +100 | Successful placement |

### Badge Levels

| Level | Points Required | Badge |
|-------|----------------|-------|
| Newcomer | 0-99 | 🌱 |
| Rising Talent | 100-249 | 🌟 |
| Bronze Achiever | 250-499 | 🏅 |
| Silver Star | 500-999 | ⭐ |
| Gold Expert | 1000-1999 | 🥇 |
| Platinum Pro | 2000-4999 | 🏆 |
| Diamond Elite | 5000+ | 💎 |

## 📈 Monitoring

### Health Checks

- Backend: `GET /health`
- AI Service: `GET /health`

### Logs

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ai-service
```

## 🔒 Security

- JWT authentication with configurable expiration
- Rate limiting on API endpoints
- File upload restrictions and validation
- CORS configuration
- Helmet.js security headers
- Input validation with Joi

## 🚀 Deployment

### Production Build

```bash
# Build for production
docker-compose -f docker-compose.prod.yml up --build
```

### Environment Considerations

- Use strong JWT secrets
- Configure proper CORS origins
- Set up SSL/TLS certificates
- Configure reverse proxy (nginx)
- Setup monitoring and logging
- Regular database backups

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@platform.com or join our Slack channel.

## 🔄 Changelog

### v1.0.0
- Initial release
- Multi-role authentication system
- AI-powered candidate matching
- Trust points gamification
- Docker containerization
```

This completes the comprehensive SaaS recruitment platform with all the requested features. The system includes multi-role authentication, AI integration for resume/LinkedIn analysis, trust points gamification, Docker containerization, and comprehensive testing setup. Each component is modular and scalable for SaaS deployment.