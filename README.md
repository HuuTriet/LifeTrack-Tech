# LifeTrack Tech - Elderly Health and Mental Monitoring System

## 📋 Project Information
- **Project Name**: Elderly Health and Mental Monitoring System
- **Project Code**: LifeTrack Tech
- **Group**: SWD392_G7
- **Type**: Web Application & Mobile Application

## 🎯 Overview
LifeTrack Tech is an integrated platform designed to support physical health monitoring, mental well-being assessment, and medication management for elderly users. The system enables family members and healthcare staff to remotely monitor health data in real-time, receive timely alerts, and intervene early when abnormal patterns are detected.

## ✨ Key Features

### 1. 💊 Medication Management
- Drug interaction detection and alerts
- Medication reminder system
- Duplicate active ingredient identification
- Risk level classification based on clinical significance

### 2. 📊 Health Monitoring
- Physical health metrics tracking (blood pressure, heart rate, temperature, SpO2)
- Long-term data analysis and trend visualization
- Anomaly detection in health indicators
- Real-time health status dashboard

### 3. 🧠 Mental Health Assessment
- Stress level monitoring
- Loneliness and emotional decline detection
- Mental well-being score tracking
- Sleep quality analysis

### 4. 👨‍👩‍👧‍👦 Family & Healthcare Dashboard
- Remote monitoring capabilities
- Real-time alerts and notifications
- Comprehensive health reports
- Multi-user access control

## 🏗️ Project Structure

```
lifetrack-tech/
├── backend/                     # ASP.NET Core Web API
│   ├── LifeTrackTech.API/      # Main API Project
│   ├── LifeTrackTech.Core/     # Domain/Business Logic
│   ├── LifeTrackTech.Infrastructure/ # Data Access
│   └── LifeTrackTech.Tests/    # Unit Tests
│
├── frontend/                    # React TypeScript
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── hooks/             # Custom hooks
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utilities
│   ├── public/                # Static files
│   └── package.json
│
├── mobile/                     # React Native (Future)
│   └── README.md
│
├── database/                   # Database scripts
│   ├── migrations/            # EF Core migrations
│   └── scripts/               # SQL scripts
│
└── docs/                      # Documentation
    ├── api/                   # API documentation
    ├── design/                # Design documents
    └── deployment/            # Deployment guides
```

## 🚀 Getting Started

### Prerequisites
- .NET 8 SDK
- Node.js >= 18.x
- SQL Server (LocalDB or Full)
- Visual Studio 2022 or VS Code

### Installation

#### Backend (.NET)
```bash
cd backend/LifeTrackTech.API
dotnet restore
dotnet ef database update
dotnet run
```

Backend API will run on: `https://localhost:7001`

#### Frontend (React TypeScript)
```bash
cd frontend
npm install
npm start
```

Frontend will run on: `http://localhost:3000`

## 🔧 Technology Stack

### Backend
- **Framework**: ASP.NET Core 8 Web API
- **ORM**: Entity Framework Core
- **Database**: SQL Server
- **Authentication**: JWT Bearer Token
- **API Documentation**: Swagger/OpenAPI
- **Architecture**: Clean Architecture
- **Patterns**: Repository Pattern, CQRS (optional)

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Redux Toolkit / Zustand
- **UI Library**: Material-UI (MUI) / Ant Design
- **Charts**: Recharts / Chart.js
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form + Zod

### Database
- **RDBMS**: Microsoft SQL Server
- **Migrations**: EF Core Migrations

## 📚 API Documentation
Swagger UI available at: `https://localhost:7001/swagger`

## 🧪 Testing

### Backend Tests
```bash
cd backend/LifeTrackTech.Tests
dotnet test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📦 Deployment

### Backend
```bash
cd backend/LifeTrackTech.API
dotnet publish -c Release -o ./publish
```

### Frontend
```bash
cd frontend
npm run build
```

## 👥 Team Members
- Nguyen Huu Triet - Group 7

## 📄 License
This project is licensed under the MIT License.

## 📞 Support
For support, email support@lifetracktech.com or open an issue in the repository.
