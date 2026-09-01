# AV Audit

AV Audit is a live event management tool for AV and production teams. It keeps everyone on the same page with real-time operational checklists, equipment dashboards, sermon recording delivery, and complete activity tracking.

---

## Table of Contents
- [User Guide](#-user-guide)
  - [Accounts & Sessions](#accounts--sessions)
  - [Active Checklists](#active-checklists)
  - [Dashboards](#dashboards)
  - [Recordings Sender](#recordings-sender)
- [Admin Guide](#-admin-guide)
  - [User Management](#user-management)
  - [Roles & Permissions](#roles--permissions)
  - [Checklist Templates](#checklist-templates)
  - [Dashboard Setup](#dashboard-setup)
  - [Audit Logs](#audit-logs)
  - [Maintenance](#maintenance)
- [Developer Guide](#-developer-guide)
  - [Stack & Requirements](#stack--requirements)
  - [Configuration](#configuration)
  - [Running with PM2](#running-with-pm2)
  - [State Ingestion API](#state-ingestion-api)
  - [Data Storage](#data-storage)
  - [License](#license)

---

# 📖 User Guide

### Accounts & Sessions
- **Sign Up**: Submit your username and password. You can log in once an admin approves your request.
- **Sign In**: Log in with your approved credentials.
- **Inactivity Warning**: A prompt warns you before timing out. Click **Keep Working** to stay logged in.
- **Change Password**: Click your profile badge in the top right to update your password anytime.

---

### Active Checklists
Run and complete operational checklists during live rehearsals and events.

- **Start a Checklist**: Click **+ Start Checklist** and choose a template.
- **Live Sync**: Multiple people can work on the same checklist at once. All checks and updates sync across all devices in real time.
- **Active Viewers**: The top bar shows who currently has the checklist open.
- **Task Types**:
  - `○` **Solid Circle**: Required task. Counts toward overall progress percentage.
  - `◌` **Dashed Circle**: Optional task. Does not count toward progress percentage.
  - `◇ ⚡` **Solid Diamond**: Required task with a webhook action.
  - `◇ ⚡` **Dashed Diamond**: Optional task with a webhook action.
- **Completing Tasks**: Click the shape icon. A badge records your name, role, and the exact completion time.
- **Flagging Issues (⚠️)**: Mark a task as blocked. It highlights in red and updates the checklist header status.
- **Adding Notes (📝)**: Attach notes or details to any task.
- **Triggering Actions (⚡)**: Click **Automate** on a task to trigger its network webhook command immediately.
- **Submitting**: When all required tasks are done, click **Submit Checklist** to lock the checklist.
- **Sharing**: Click **Share** to copy a link. Pasting it into messenger apps generates a live card preview with current progress.

---

### Dashboards
Monitor system status and control equipment from one visual view.

- **Switch Dashboards**: Use the dropdown menu at the top to change views.
- **Controls**:
  - **Switches**: Turn power, streams, or feeds on and off.
  - **Steppers & Sliders**: Adjust values, levels, and presets.
  - **Status Badges**: View live state readouts and health indicators.

---

### Recordings Sender
Deliver recorded media files right after an event.

1. **Upload**: Drag and drop audio or video files into the upload box.
2. **Details**: Set the speaker name, service type, and date.
3. **Send**: Click **Send Recording Notification** to email the distribution list.
4. **History**: View past deliveries and resend if needed.

---

# 🛡️ Admin Guide

### User Management
- **Pending Queue**: Review new sign-ups. Click **Approve (✓)** to activate an account or **Reject (✕)** to decline it.
- **Directory Actions**:
  - **Assign Roles**: Update a user's assigned role.
  - **Reset Password**: Overwrite a user's password directly.
  - **Suspend / Activate**: Temporarily disable an account without deleting it.
  - **Delete User**: Permanently remove an account.

---

### Roles & Permissions
- **Hierarchy Order**: Drag and drop roles to set seniority order.
- **Role Colors**: Pick a custom color and label for each role.
- **Granular Permissions**: Enable or disable specific access for each role:
  - Checklists (view, start, check, flag, submit, delete)
  - Templates (create, edit, delete, import/export)
  - Dashboards (view, edit, automations)
  - Sermons (upload, send, view history)
  - Accounts (manage users, approve sign-ups, change passwords)
  - Audit logs (view event history)
- **Default Role**: Set which role newly approved users get automatically.

---

### Checklist Templates
Build standard operating procedures for your team.

- **Create & Edit**: Add sections and tasks. Indent tasks to create nested subtasks.
- **Reorder**: Drag and drop tasks and sections to reorder them.
- **Day Scheduling**: Restrict tasks or sections to specific days of the week so only relevant items appear when a checklist starts.
- **Webhook Hooks**: Attach HTTP requests (`GET`, `POST`, `PUT`, `DELETE`) with URLs, headers, and payloads to tasks.
- **Export & Import**: Download templates as JSON backup files or import existing ones.

---

### Dashboard Setup
- **Card Layouts**: Add, edit, and arrange modular switches, sliders, steppers, and status badges.
- **Automation Rules**: Build multi-step macro sequences that execute when values change or buttons are pressed.

---

### Audit Logs
- **Event Timeline**: Chronological record of user logins, task completions, approvals, password changes, and system actions.
- **Filters**: Filter events by date range, specific user, or action type.

---

### Maintenance
- **Auto-Purge**: Submitted checklists automatically purge after 6 hours.
- **Bulk Delete**: Clear all active checklists in one click from the grid header.

---

# 💻 Developer Guide

### Stack & Requirements
- **Runtime**: Node.js `v18.0.0` or higher
- **Backend**: Express 5, Socket.IO 4
- **Frontend**: Vanilla HTML5, CSS3, ES6+ JS (no build or bundle steps needed)
- **Email**: Nodemailer (SMTP)
- **Image Generation**: Resvg for dynamic preview cards

```bash
# Clone and install dependencies
git clone <repository-url>
cd av-audit
npm install
```

---

### Configuration
Settings are defined in `config.json` or environment variables:

```json
{
  "port": 3011,
  "jwtSecret": "your-jwt-secret",
  "timezone": "America/Los_Angeles",
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "user": "notifications@example.com",
    "pass": "your-password",
    "from": "\"AV Audit\" <notifications@example.com>",
    "defaultRecipients": "team@example.com"
  }
}
```

---

### Running with PM2
For production deployment with process monitoring and auto-restart:

```bash
# Start server
pm2 start server.js --name "av-audit"

# Save process list for system reboot
pm2 save
pm2 startup
```

---

### State Ingestion API
External controllers, Stream Decks, and IoT hardware can update dashboard state via HTTP:

```http
GET  /info/:key?val=:value
POST /api/info/:key
Content-Type: application/json

{
  "val": "ONLINE",
  "meta": { "bitrate": "6000kbps" }
}
```

---

### Data Storage
- **Database**: All data (users, roles, templates, active checklists, logs) is stored in `data/av_audit_db.json`.
- **Uploads**: Media files are stored in `uploads/sermons/`.
- **Backups**: Back up the `data/` and `uploads/` folders. Code updates do not touch persistent data.

---

### License
Proprietary. All Rights Reserved. See [`LICENSE`](file:///d:/Projects/AV%20Audit/LICENSE) for details.
