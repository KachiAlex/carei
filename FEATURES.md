# CAREi App - Features Documentation

## Overview
CAREi is a comprehensive care management platform with multi-tenant architecture, supporting multiple user roles (carers, managers, family members, superadmins) across web and mobile (Capacitor/Android) platforms.

---

## User Roles & Authentication

### Multi-Tenancy
- **Tenant Isolation**: Each tenant operates in an isolated data environment
- **Tenant Selection**: Users can belong to multiple tenants and switch between them
- **Tenant-Specific Data**: All data (clients, visits, tasks, etc.) is scoped to the tenant
- **Slug-Based Routing**: Tenant identification via URL slug (`/tenant/:slug/...`)

### Authentication Methods
- **Email/Password Login**: Standard authentication for carers and managers
- **OTP-Based Login**: One-time password authentication for enhanced security
- **Biometric Authentication**: Fingerprint/Face ID support on mobile devices
- **Family PIN Authentication**: 6-digit PIN-based login for family members
- **Invite-Based Registration**: New users can join via invitation links
- **Token-Based Auth**: JWT tokens with refresh token support
- **Secure Storage**: Encrypted local storage for tokens and credentials

---

## Role-Based Features

### 1. Carer Role

#### Dashboard
- **Active Visits**: See currently active care visits with real-time status
- **Scheduled Visits**: View upcoming assigned visits for the day/week
- **Client Quick Access**: Quick access to assigned clients' profiles
- **Task Overview**: View pending and completed tasks
- **Notifications**: Real-time alerts for visit changes, new assignments

#### Visit Management
- **Start Active Visit**: Begin a care visit with client information pre-loaded
- **Real-Time Visit Recording**:
  - **Vitals Recording**: Blood pressure, pulse, O2 saturation, temperature
  - **Fluid Intake**: Track glasses of water/other fluids consumed
  - **Mood Assessment**: Record client's mood status
  - **Nutrition Notes**: Document meal consumption and dietary notes
  - **Tasks Checklist**: Complete care tasks during visit
  - **Medication Administration**: Log medications given
  - **Body Map**: Visual documentation of care areas or injuries
  - **Voice Memos**: Audio notes for quick documentation
  - **Handover Notes**: End-of-shift handover information
- **Visit Submission**: Submit completed visit for manager review
- **Draft Saving**: Save visit as draft to complete later

#### Client Information
- **Client Profiles**: View detailed client information (age, conditions, preferences)
- **Care Plans**: Access client care plans with objectives and tasks
- **Visit History**: View past visit records and summaries
- **Emergency Contacts**: Access emergency contact information

#### Communication
- **Family Messages**: Send and receive messages with family members
- **Visit Notes**: Share notes with managers and other carers

---

### 2. Manager Role

#### Dashboard
- **Team Overview**: View all assigned carers and their status
- **Client Overview**: See all clients under management
- **Visit Statistics**: Daily/weekly visit metrics
- **Approval Queue**: Pending visit approvals
- **Activity Feed**: Recent system activities and changes

#### Client Management
- **Client Profiles**: Create, edit, and delete client records
- **Client Details**: Age, conditions, preferences, emergency contacts
- **Carer Assignments**: Assign carers to clients
- **Visit Scheduling**: Schedule visits for clients
- **Care Plan Management**: Create and manage care plans
  - **Objectives**: Set care objectives
  - **Preventive Measures**: Document preventive care strategies
  - **Risk Assessment**: Identify and document risks
- **Archive Clients**: Archive inactive client records

#### Carer Management
- **Carer Profiles**: Create, edit, and delete carer accounts
- **Carer Details**: Contact information, certifications, status
- **Status Management**: Active, inactive, on leave
- **Performance Tracking**: Monitor carer performance metrics
- **Bulk Operations**: Bulk invite carers, update statuses

#### Visit Management
- **Visit Approval**: Review and approve/reject submitted visits
- **Visit History**: View all visit records with filters
- **Visit Details**: Detailed view of completed visits
- **Visit Approvals**: Dedicated screen for pending approvals
- **Visit Scheduling**: Schedule and reschedule visits

#### Care Plan Management
- **Care Plan Editor**: Rich editor for creating comprehensive care plans
- **Templates**: Use pre-built care plan templates
- **Publishing**: Publish care plans for carers to access
- **Versioning**: Track care plan versions and changes
- **Archive**: Archive outdated care plans

#### Family Management
- **Family Member Invitations**: Invite family members to access client information
- **Access Levels**: Assign access levels (Primary, Secondary, Limited)
- **Family Portal Management**: Manage family member accounts

#### Audit & Compliance
- **Audit Logs**: View system activity logs
- **Data Export**: Export data for compliance and reporting
- **Data Deletion**: Handle data deletion requests (GDPR compliance)

---

### 3. Family Member Role

#### Family Portal
- **Secure PIN Login**: 6-digit PIN for family member authentication
- **Dashboard**: Overview of client's care information
- **Visit Updates**: Real-time updates on completed visits
- **Care Plan Access**: View client's care plan (based on access level)

#### Communication
- **Send Messages**: Send messages to carers and managers
- **View Messages**: Read messages from care team
- **Visit Notes**: Access visit notes and summaries

#### Access Levels
- **Limited Access**: View visit summaries and send messages only
- **Enhanced Access**: View care plans, tasks, schedules, notifications
- **Full Access**: Manage other family members, approve changes, detailed reports

---

### 4. Superadmin Role

#### Tenant Management
- **Create Tenants**: Create new tenant organizations
- **Tenant Configuration**: Configure tenant settings, plans, pricing
- **Tenant Statistics**: View tenant usage statistics
- **Member Management**: Manage tenant members (users)
- **Plan Management**: Manage subscription plans (trial, paid)
- **Pricing Models**: Configure pricing (per-carer, flat rate)
- **Active/Inactive**: Activate or deactivate tenants

#### System Administration
- **User Management**: View and manage all system users
- **Agency Management**: Manage care agencies
- **System-wide Settings**: Configure system-wide parameters
- **Audit Logs**: View all system activity across tenants

---

## Core Features

### Visit Management
- **Visit Scheduling**: Schedule visits with date, time, duration, assigned carer
- **Visit Tracking**: Real-time tracking of active visits
- **Visit Recording**: Comprehensive visit documentation
  - Vitals (BP, pulse, O2 sat, temperature)
  - Fluid intake tracking
  - Mood assessment
  - Nutrition notes
  - Task completion
  - Medication logs
  - Body map annotations
  - Voice memos
  - Handover notes
- **Visit Approval**: Manager approval workflow
- **Visit History**: Complete visit history with search/filter
- **Visit Drafts**: Save incomplete visits as drafts

### Care Plan Management
- **Care Plan Creation**: Rich editor for comprehensive care plans
- **Templates**: Pre-built care plan templates for quick setup
- **Objectives**: Define care objectives
- **Preventive Measures**: Document preventive care strategies
- **Risk Assessment**: Identify and document risks
- **Publishing**: Publish care plans for carer access
- **Archiving**: Archive outdated care plans

### Task Management
- **Task Assignment**: Assign tasks to carers
- **Task Tracking**: Track task completion during visits
- **Task Templates**: Reusable task templates
- **Task Categories**: Organize tasks by category

### Body Map Feature
- **Visual Documentation**: Annotate body diagrams for care documentation
- **Injury Tracking**: Track injuries, bruises, or care areas
- **Visual Records**: Visual documentation of care provided

### Communication
- **Family Messages**: Bidirectional messaging between family and care team
- **Visit Notes**: Share notes between carers and managers
- **Notifications**: Real-time alerts for important events

### Emergency Features
- **SOS Alerts**: Emergency alert system for urgent situations
- **SOS Resolution**: Mark SOS alerts as resolved
- **Emergency Contacts**: Quick access to emergency contact information

### Scheduling
- **Rota Management**: Manage carer schedules and rotas
- **Visit Scheduling**: Schedule individual visits
- **Calendar View**: Visual calendar for scheduling

### Reporting & Analytics
- **Visit Statistics**: Visit completion rates, metrics
- **Performance Tracking**: Carer performance metrics
- **Data Export**: Export data to CSV for reporting
- **Audit Logs**: System activity logs for compliance

### Multi-Platform Support
- **Web Application**: Full-featured web app
- **Mobile App (Android)**: Native Android app via Capacitor
- **Responsive Design**: Optimized for all screen sizes
- **Offline Support**: Limited offline capabilities

---

## Technical Features

### Security
- **Multi-Tenant Architecture**: Complete data isolation between tenants
- **Role-Based Access Control**: Granular permissions per role
- **Token-Based Authentication**: JWT with refresh tokens
- **Secure Storage**: Encrypted local storage for sensitive data
- **Biometric Authentication**: Fingerprint/Face ID on mobile
- **PIN Authentication**: Family member PIN-based login
- **Rate Limiting**: API rate limiting for security
- **CORS Configuration**: Configurable CORS for multi-platform access

### Performance
- **Retry Logic**: Automatic retry with exponential backoff for failed requests
- **Optimized Loading**: Lazy loading and code splitting
- **PWA Support**: Progressive Web App capabilities
- **Service Worker**: Offline support and caching

### Data Management
- **Database Migrations**: Automated schema migrations
- **Data Export**: CSV export for compliance
- **Data Deletion**: GDPR-compliant data deletion
- **Audit Logging**: Complete activity tracking

### Deployment
- **Vercel Deployment**: Production deployment on Vercel
- **Environment Configuration**: Multiple environment support
- **API Versioning**: Structured API endpoints

---

## Integration Features

### Family Portal
- **Family Login**: Dedicated family member login
- **Access Control**: Three-tier access levels
- **Real-time Updates**: Live updates on client care
- **Message Center**: Communication with care team

### External Integrations
- **Email Notifications**: Email-based notifications
- **SMS Support**: SMS notifications (planned)
- **Share Capabilities**: Native share on mobile

---

## UI/UX Features

### Responsive Design
- **Mobile-First**: Optimized for mobile devices
- **Tablet Support**: Optimized for tablet screens
- **Desktop Support**: Full-featured desktop experience

### Accessibility
- **High Contrast**: High contrast mode support
- **Screen Reader**: Screen reader compatibility
- **Touch-Friendly**: Large touch targets on mobile

### Animations
- **Smooth Transitions**: Framer Motion animations
- **Loading States**: Clear loading indicators
- **Error States**: User-friendly error messages

---

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token
- `POST /auth/verify-otp` - OTP verification
- `POST /auth/send-otp` - Send OTP

### Family Auth
- `POST /family/auth/login` - Family member PIN login
- `POST /family/auth/logout` - Family logout
- `POST /family/auth/refresh` - Refresh family token
- `POST /family/auth/forgot-password` - Forgot password
- `POST /family/auth/reset-password` - Reset password

### Clients
- `GET /clients` - List clients
- `POST /clients` - Create client
- `PUT /clients/:id` - Update client
- `DELETE /clients/:id` - Delete client

### Visits
- `GET /visits` - List visits
- `POST /visits` - Create visit
- `PUT /visits/:id` - Update visit
- `DELETE /visits/:id` - Delete visit
- `POST /visits/start` - Start visit
- `POST /visits/submit` - Submit visit
- `POST /visits/approve` - Approve visit

### Care Plans
- `GET /care-plans` - List care plans
- `POST /care-plans` - Create care plan
- `PUT /care-plans/:id` - Update care plan
- `PATCH /care-plans/:id?action=publish` - Publish care plan
- `PATCH /care-plans/:id?action=archive` - Archive care plan

### Family Members
- `GET /family/members` - List family members
- `POST /family/members/invite` - Invite family member
- `PUT /family/members/:id` - Update family member
- `DELETE /family/members/:id` - Delete family member

### Carers
- `GET /carers` - List carers
- `POST /carers` - Create carer
- `PUT /carers/:id` - Update carer
- `DELETE /carers/:id` - Delete carer
- `PATCH /carers/:id/status` - Update carer status

### Tasks
- `GET /tasks` - List tasks
- `POST /tasks` - Create task
- `PUT /tasks/:id` - Update task
- `DELETE /tasks/:id` - Delete task

### Tenants
- `GET /tenants` - List tenants
- `POST /tenants` - Create tenant
- `PUT /tenants/:id` - Update tenant
- `DELETE /tenants/:id` - Delete tenant
- `PATCH /tenants/:id/plan` - Update tenant plan
- `PATCH /tenants/:id/active` - Activate/deactivate tenant

### Audit & Export
- `GET /audit-logs` - List audit logs
- `POST /data-export` - Export data
- `POST /data-delete` - Delete user data

---

## Database Schema

### Core Tables
- **users**: System users
- **tenants**: Tenant organizations
- **tenant_users**: User-tenant relationships
- **clients**: Client profiles
- **visits**: Visit records
- **tasks**: Care tasks
- **care_plans**: Care plans
- **family_members**: Family member accounts
- **family_messages**: Family messages
- **audit_logs**: System activity logs

---

## Future/Planned Features

### Enhancements
- **Video Calling**: Video calls between family and care team
- **Medication Reminders**: Automated medication reminders
- **AI-Powered Insights**: AI-driven care recommendations
- **Advanced Analytics**: More detailed analytics and reporting
- **Integration with Health Systems**: EHR integration
- **Multi-Language Support**: Localization for multiple languages

---

## Support & Help

### Documentation
- In-app help and tutorials
- User guides for each role
- API documentation

### Support Channels
- In-app support chat
- Email support
- Phone support (for enterprise)

---

*Last Updated: July 2026*
