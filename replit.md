# AttendanceQR - Employee Attendance Management System

## Overview

AttendanceQR is a comprehensive web-based employee attendance management system that uses QR codes for secure employee check-ins. The application allows organizations to manage employee data, generate secure QR codes for each employee, scan QR codes for attendance tracking, manage work rosters, handle leave requests, and generate detailed reports. The system features robust security through token-based QR code validation and provides real-time monitoring dashboards with visual analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives for consistent design
- **Styling**: Tailwind CSS with custom design tokens and dark mode support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **API Design**: RESTful API structure with dedicated routes for employees, attendance, roster, leave requests, and QR token management
- **Data Validation**: Zod schemas for runtime type checking and API payload validation
- **Session Management**: Express sessions with PostgreSQL session store
- **File Structure**: Modular architecture with separate route handlers and storage abstraction layer

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL for scalable cloud hosting
- **Schema Management**: Drizzle Kit for database migrations and schema evolution
- **Storage Pattern**: Repository pattern with interface-based storage abstraction for testability

### Authentication and Authorization
- **QR Code Security**: Token-based validation system using employee ID + secret key hashing
- **Token Generation**: Base64 encoding with timestamp and secret key for QR code integrity
- **Validation Flow**: Server-side token verification against stored employee data
- **Access Control**: Route-based protection with session validation

### External Dependencies
- **QR Code Generation**: qrcode.js library for client-side QR code creation
- **QR Code Scanning**: jsQR library for camera-based QR code reading
- **Charts and Analytics**: Chart.js for dashboard visualizations and attendance analytics
- **PDF Generation**: jsPDF for generating attendance reports and exports
- **Date Handling**: date-fns for consistent date manipulation and formatting
- **Camera Access**: Browser MediaDevices API for QR code scanning functionality

### Key Features and Business Logic
- **QR Code Workflow**: Generate secure tokens, embed in QR codes, validate on scan, record attendance
- **Roster Management**: Schedule employees for specific dates and shifts (Shift 1, Shift 2) with status tracking
- **Leave Management**: Request submission, approval workflow, and calendar integration
- **Reporting System**: Exportable reports in PDF and CSV formats with date range filtering
- **Real-time Dashboard**: Live attendance statistics with visual charts for management overview

### Recent Changes
- **August 17, 2025**: Updated shift system from "Pagi, Siang, Malam" to "Shift 1, Shift 2" across all components
- **QR Code System**: Implemented consistent token generation using stable employee-based tokens instead of timestamp-based
- **Real-time Updates**: Added automatic cache invalidation for roster and attendance data after successful QR scan