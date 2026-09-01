// Permission Registry for AV Audit as specified in PRD Section 3.1
const PERMISSION_REGISTRY = {
  checklists: [
    'access_nav',
    'view_active',
    'create_active',
    'delete_active',
    'edit_templates',
    'execute_automations'
  ],
  roles: [
    'access_nav',
    'manage_roles'
  ],
  accounts: [
    'access_nav',
    'view_users',
    'admit_pending',
    'modify_passwords',
    'toggle_suspension'
  ],
  audit: [
    'access_nav',
    'delete_logs',
    'configure_retention'
  ],
  dashboards: [
    'access_nav',
    'manage_dashboards'
  ],
  sermon_sender: [
    'access_nav',
    'view_history',
    'manage_settings'
  ]
};

const PERMISSION_METADATA = {
  sermon_sender: {
    label: 'Recordings Sender',
    description: 'Compress and email audio recordings, manage email templates, and view history',
    permissions: {
      access_nav: { label: 'Access Recordings Sender', description: 'Show, access, and send audio recordings in Recordings Sender' },
      view_history: { label: 'View Submission History', description: 'View previously submitted recordings list, resend, and delete recordings' },
      manage_settings: { label: 'Manage Settings', description: 'Configure Gmail credentials, templates, and retention policies' }
    }
  },
  dashboards: {
    label: 'Dashboards',
    description: 'Customizable multi-dashboard flight control, widgets, and access settings',
    permissions: {
      access_nav: { label: 'Access Dashboards', description: 'Show and view authorized flight control dashboards' },
      manage_dashboards: { label: 'Manage Dashboards', description: 'Create, edit settings, assign role access, and delete dashboards' }
    }
  },
  checklists: {
    label: 'Checklists & Templates',
    description: 'Operational checklists, active tasks, templates, and automation hooks',
    permissions: {
      access_nav: { label: 'Access Navigation', description: 'Show Checklists in navigation menu' },
      view_active: { label: 'View Active Checklists', description: 'View active checklist instances and task states' },
      create_active: { label: 'Create Active Checklist', description: 'Instantiate checklists from templates' },
      delete_active: { label: 'Delete Active Checklist', description: 'Delete or cancel active checklist instances' },
      edit_templates: { label: 'Manage Templates', description: 'Create, edit, delete templates and in-line sync' },
      execute_automations: { label: 'Execute Automations', description: 'Trigger cURL automation webhooks' }
    }
  },
  roles: {
    label: 'Roles & Hierarchy',
    description: 'Discord-style role hierarchy and permission assignments',
    permissions: {
      access_nav: { label: 'Access Navigation', description: 'Show Roles in navigation menu' },
      manage_roles: { label: 'Manage Roles', description: 'Create, edit, reorder hierarchy, and assign permissions' }
    }
  },
  accounts: {
    label: 'Account Management',
    description: 'User approvals, directory, suspensions, and password resets',
    permissions: {
      access_nav: { label: 'Access Navigation', description: 'Show Accounts in navigation menu' },
      view_users: { label: 'View Users Directory', description: 'Search and inspect all user accounts' },
      admit_pending: { label: 'Admit / Reject Pending', description: 'Approve or reject newly registered users' },
      modify_passwords: { label: 'Modify Passwords', description: 'Overwrite user passwords' },
      toggle_suspension: { label: 'Toggle Suspension', description: 'Suspend or reactivate user accounts' }
    }
  },
  audit: {
    label: 'Audit Log & Retention',
    description: 'System event logs, day grouping, and retention cleanup',
    permissions: {
      access_nav: { label: 'Access Navigation', description: 'Show Audit Log in navigation menu' },
      delete_logs: { label: 'Delete / Purge Logs', description: 'Manually purge today\'s or all audit logs' },
      configure_retention: { label: 'Configure Retention', description: 'Adjust automated log retention threshold' }
    }
  }
};

// Helper: Check if a set of permissions includes a specific permission (formatted as "module.action" or "action")
function hasPermission(userPermissions, module, action, isAdmin = false) {
  if (isAdmin) return true;
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  
  const exactKey = `${module}.${action}`;
  return userPermissions.includes(exactKey) || userPermissions.includes('*');
}

// Return all valid permission keys in "module.action" format
function getAllPermissionKeys() {
  const keys = [];
  for (const [module, actions] of Object.entries(PERMISSION_REGISTRY)) {
    for (const action of actions) {
      keys.push(`${module}.${action}`);
    }
  }
  return keys;
}

module.exports = {
  PERMISSION_REGISTRY,
  PERMISSION_METADATA,
  hasPermission,
  getAllPermissionKeys
};
