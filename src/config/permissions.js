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
  ],
  system: [
    'manage_updates'
  ]
};

const PERMISSION_METADATA = {
  system: {
    label: 'System & Maintenance',
    description: 'Software updates and system maintenance',
    permissions: {
      manage_updates: { label: 'Manage System Updates', description: 'Check for and install software updates' }
    }
  },
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
    description: 'Customizable dashboard layouts, widgets, and access settings',
    permissions: {
      access_nav: { label: 'Access Dashboards', description: 'Show and view authorized dashboards' },
      manage_dashboards: { label: 'Manage Dashboards', description: 'Create, edit settings, assign role access, and delete dashboards' }
    }
  },
  checklists: {
    label: 'Checklists & Templates',
    description: 'Operational checklists, active tasks, templates, and automations',
    permissions: {
      access_nav: { label: 'Access Page', description: 'Show Checklists page' },
      view_active: { label: 'View Started Checklists', description: 'View started checklists' },
      create_active: { label: 'Start Checklist', description: 'Start checklists from templates' },
      delete_active: { label: 'Delete Started Checklist', description: 'Delete or cancel started checklists' },
      edit_templates: { label: 'Manage Templates', description: 'Create, edit, delete templates' },
      execute_automations: { label: 'Execute Automations', description: 'Trigger automations' }
    }
  },
  roles: {
    label: 'Roles & Hierarchy',
    description: 'Manage role and permission assignments',
    permissions: {
      access_nav: { label: 'View Roles', description: 'View user roles' },
      manage_roles: { label: 'Manage Roles', description: 'Create, delete, reorder roles and assign permissions' }
    }
  },
  accounts: {
    label: 'Account Management',
    description: 'User approvals, directory, suspensions, and password resets',
    permissions: {
      access_nav: { label: 'Access Page', description: 'Show Accounts in navigation menu' },
      view_users: { label: 'View Users Directory', description: 'Search and inspect all user accounts' },
      admit_pending: { label: 'Admit / Reject Pending', description: 'Approve or reject newly registered users' },
      modify_passwords: { label: 'Modify Passwords', description: 'Overwrite user passwords' },
      toggle_suspension: { label: 'Toggle Suspension', description: 'Suspend or reactivate user accounts' }
    }
  },
  audit: {
    label: 'Audit Log',
    description: 'System event logs',
    permissions: {
      access_nav: { label: 'Access Page', description: 'Show Audit Log in navigation menu' },
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
