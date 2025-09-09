# AttendanceQR - Employee Attendance Management System

## Overview
AttendanceQR is a web-based employee attendance management system that utilizes QR codes for secure check-ins. It enables organizations to manage employee data, generate secure QR codes, track attendance, manage work rosters, handle leave requests, and generate reports. The system provides real-time monitoring dashboards with visual analytics and robust security through token-based QR code validation. The project aims to streamline attendance processes and provide comprehensive oversight for workforce management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
- **UI**: Shadcn/ui (Radix UI), Tailwind CSS (with dark mode)
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with Express.js
- **API**: RESTful, modular architecture
- **Data Validation**: Zod schemas
- **Session Management**: Express sessions with PostgreSQL store

### Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Schema Management**: Drizzle Kit
- **Storage Pattern**: Repository pattern

### Authentication and Authorization
- **QR Code Security**: Token-based validation (employee ID + secret key hashing)
- **Token Generation**: Base64 encoding with timestamp and secret key
- **Access Control**: Route-based session validation

### Key Features
- **QR Code Workflow**: Generation, secure token embedding, validation, attendance recording.
- **Roster Management**: Employee scheduling for shifts with status tracking, bulk upload via Excel.
- **Leave Management**: Request submission, approval workflow, calendar integration, and analytics.
- **Reporting System**: Exportable PDF/CSV reports with date range filtering, professional styling.
- **Real-time Dashboard**: Live attendance statistics, visual charts, and auto-refresh.
- **Employee Management**: CRUD operations for employees, bulk import via Excel, NIK-based search.
- **Shift System**: "Shift 1" (06:00-18:00) and "Shift 2" (18:00-06:00) with time-based automatic detection and validation.
- **Auto Save**: Draft recovery for forms using local storage.

## External Dependencies
- **QR Code Generation**: `qrcode.js`
- **QR Code Scanning**: `jsQR`
- **Charts**: `Chart.js`
- **PDF Generation**: `jsPDF`
- **Date Handling**: `date-fns`
- **Camera Access**: Browser MediaDevices API