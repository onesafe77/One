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
- **August 20, 2025**: CRITICAL BUG FIXES - Fixed photo upload auto-blast issue and optimized loading performance
- **August 20, 2025**: Photo upload now only uploads without triggering automatic blast sending
- **August 20, 2025**: Added clear UI indicators: "Hanya upload foto, tidak akan auto-blast" 
- **August 20, 2025**: Improved loading states with proper upload progress indicators
- **August 20, 2025**: Optimized query caching - employee data cached for 5 minutes, blast history cached for 30 seconds
- **August 20, 2025**: Added dashboard evaluasi with real-time statistics, performance tracking, and API connection test
- **August 20, 2025**: Enhanced incident blast form with better upload feedback and status indicators
- **August 20, 2025**: Disabled button during upload to prevent accidental blast sending
- **August 19, 2025**: Consolidated all leave management features into unified main Cuti page with attractive tabbed interface
- **August 19, 2025**: Removed separate pages for leave monitoring, leave evaluation, and leave roster upload
- **August 19, 2025**: Created 5-tab system: Pengajuan, Upload Roster, Evaluasi, Monitoring, and Daftar Cuti
- **August 19, 2025**: Integrated comprehensive leave analytics dashboard with charts and statistics
- **August 19, 2025**: Added automated WhatsApp monitoring with reminder history tracking
- **August 19, 2025**: Streamlined navigation by removing redundant leave management pages
- **August 18, 2025**: Enhanced employee save functionality with improved validation and user feedback messages
- **August 18, 2025**: Added cancel button and better form handling for employee creation/editing dialog
- **August 18, 2025**: Fixed duplicate field issue in employee form and improved button states (Save/Update)
- **August 18, 2025**: Enhanced toast notifications to show employee name and ID after successful save/update operations
- **August 18, 2025**: Enhanced dashboard with real-time attendance tracking and date filtering capabilities
- **August 18, 2025**: Added dashboard API endpoints for attendance details and recent activities with date filtering
- **August 18, 2025**: Implemented auto-refresh functionality (30-second intervals) for real-time dashboard updates
- **August 18, 2025**: Created detailed attendance table showing employee attendance status, shift, jam tidur, and fit-to-work status
- **August 18, 2025**: Updated dashboard charts to use red color theme matching application branding
- **August 18, 2025**: Replaced company logo with uploaded image in sidebar header
- **August 18, 2025**: Changed application color scheme from blue to red (#ff1100) - updated primary colors, accent colors, and chart colors across both light and dark themes
- **August 18, 2025**: Fixed QR scan results to display roster-based time and shift instead of system-detected time
- **August 18, 2025**: Implemented real-time report updates - reports now force refresh data before generation to ensure latest attendance data
- **August 18, 2025**: Fixed PDF generation logic to group employees by scheduled shift rather than check-in time detection
- **August 18, 2025**: Enhanced PDF reports to use actual attendance data (jam tidur, fit to work) instead of roster defaults
- **August 18, 2025**: Migrated from MemStorage to DrizzleStorage using PostgreSQL for permanent data persistence
- **August 18, 2025**: Implemented automatic QR Code generation for all new employees (both single creation and bulk upload via Excel)
- **August 18, 2025**: Added visual QR Code display with View and Download buttons in employee table columns
- **August 18, 2025**: Created QRCodeDisplay component for popup viewing and PNG download of QR codes with proper naming convention
- **August 18, 2025**: Optimized QR Code validation performance - reduced loading time from 4+ seconds to under 300ms
- **August 18, 2025**: Fixed time display consistency - roster times now correctly show scheduled shift times instead of current system time
- **August 18, 2025**: Enhanced cache invalidation strategy for improved real-time updates with minimal performance impact
- **August 18, 2025**: Fixed shift transition validation - now allows more flexible check-in times to accommodate real-world work schedules
- **August 18, 2025**: Resolved attendance recording issues - employees can now successfully check-in during extended shift windows
- **August 18, 2025**: Updated shift criteria to match actual roster data - Shift 1 (08:00-16:00) and Shift 2 (18:00-06:00) with appropriate check-in windows
- **August 18, 2025**: Synchronized frontend and backend shift timing calculations for consistent user experience
- **August 18, 2025**: Simplified jam tidur display format - removed "jam" suffix from dropdown options and table displays for cleaner UI
- **August 18, 2025**: Enhanced shift check-in flexibility - Shift 1 (06:00-18:00 window) and Shift 2 (12:00-10:00 window) for better operational support
- **August 18, 2025**: Fixed real-time timestamp capture - attendance now records exact check-in time (HH:MM:SS format) matching system clock
- **August 18, 2025**: Implemented comprehensive real-time data updates - dashboard refreshes every 15 seconds with forced cache invalidation for immediate attendance visibility
- **August 17, 2025**: Added Excel upload functionality for roster management with bulk import capabilities
- **August 17, 2025**: Implemented shift filter on roster page with options: "Semua Shift", "Shift 1 saja", "Shift 2 saja"  
- **August 17, 2025**: Added template Excel download feature for roster data with proper NIK format examples
- **August 17, 2025**: Created bulk roster upload API endpoint with validation for employee existence and data integrity
- **August 17, 2025**: Enhanced roster UI with upload dialog, file selection, and progress indicators
- **August 17, 2025**: Completely restructured Employee schema - removed Nomor Lambung and Shift columns, replaced with Position, Department, and Investor Group fields
- **August 17, 2025**: Added Excel upload functionality for bulk employee data import with validation
- **August 17, 2025**: Implemented NIK-based search filtering replacing shift filter on employee management page
- **August 17, 2025**: Created downloadable Excel template with new employee structure format
- **August 17, 2025**: Added bulk employee upload API endpoint with error handling and validation
- **August 17, 2025**: Fixed roster page display to show Position instead of deprecated Nomor Lambung column
- **August 17, 2025**: Updated roster employee selection dropdowns to display position instead of nomor lambung
- **August 17, 2025**: Fixed PDF download error handling and updated PDF format to match new employee structure
- **August 17, 2025**: Added Nomor Lambung column back to employee schema after Position column
- **August 17, 2025**: Updated employee form, roster display, and Excel template to include Nomor Lambung field
- **August 17, 2025**: Modified roster employee dropdowns to prioritize Nomor Lambung over position for display
- **August 17, 2025**: Implemented auto save functionality with draft recovery for employee, roster, and leave request forms
- **August 17, 2025**: Added auto save indicators showing "Menyimpan draft..." and "Draft tersimpan" status messages
- **August 17, 2025**: Created auto save hook with localStorage persistence and 24-hour draft expiration
- **August 17, 2025**: Added search functionality for employee name or NIK in QR Code generation page with real-time filtering
- **August 17, 2025**: Updated shift system from "Pagi, Siang, Malam" to "Shift 1, Shift 2" across all components
- **August 17, 2025**: Implemented time-based shift criteria: Shift 1 (06:00-18:00) and Shift 2 (18:00-06:00) with automatic shift detection during attendance
- **August 17, 2025**: Fixed shift validation criteria to correctly match Shift 1 (06:00-18:00) and Shift 2 (18:00-06:00) with flexible 30-minute window
- **QR Code System**: Implemented consistent token generation using stable employee-based tokens instead of timestamp-based
- **Real-time Updates**: Added automatic cache invalidation for roster and attendance data after successful QR scan
- **Shift Validation**: Added server-side validation to ensure employees check-in during their scheduled shift based on time