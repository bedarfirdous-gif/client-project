import React from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import { Eye, Lock } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

/**
 * Read-Only Mode Banner - Shows when user has view-only access
 */
export const ReadOnlyBanner = ({ module = 'this module' }) => {
  const { isReadOnly, getRoleInfo } = usePermissions();
  
  if (!isReadOnly()) return null;
  
  const roleInfo = getRoleInfo();
  
  return (
    <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 mb-4 flex items-center gap-3" data-testid="read-only-banner">
      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
        <Eye className="w-5 h-5 text-gray-600" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-800 flex items-center gap-2">
          View-Only Mode
          <Badge className={roleInfo.badge}>{roleInfo.label}</Badge>
        </p>
        <p className="text-sm text-gray-600">
          You have read-only access to {module}. Contact your administrator for edit permissions.
        </p>
      </div>
    </div>
  );
};

/**
 * Action Guard - Wraps action buttons and hides them for unauthorized users
 * Usage: <ActionGuard module="invoices" action="create"><Button>Create Invoice</Button></ActionGuard>
 */
export const ActionGuard = ({ 
  module, 
  action, 
  children, 
  fallback = null,
  showLocked = false 
}) => {
  const { canPerformAction, isReadOnly } = usePermissions();
  
  const canPerform = canPerformAction(module, action);
  
  if (canPerform) {
    return children;
  }
  
  // Show locked indicator if requested
  if (showLocked && isReadOnly()) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 text-gray-400 cursor-not-allowed">
              <Lock className="w-4 h-4" />
              <span className="text-sm">View Only</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>You don&apos;t have permission to {action} in {module}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return fallback;
};

/**
 * Role Badge - Displays current user's role
 */
export const RoleBadge = ({ showLabel = true }) => {
  const { getRoleInfo, userRole } = usePermissions();
  
  if (!userRole) return null;
  
  const roleInfo = getRoleInfo();
  
  return (
    <Badge className={`${roleInfo.badge} ${showLabel ? '' : 'px-2'}`} data-testid="role-badge">
      {showLabel ? roleInfo.label : userRole.charAt(0).toUpperCase()}
    </Badge>
  );
};

/**
 * Permission Check - Conditional rendering based on permission
 * Usage: <PermissionCheck permission="user_management"><AdminPanel /></PermissionCheck>
 */
export const PermissionCheck = ({ permission, children, fallback = null }) => {
  const { hasPermission } = usePermissions();
  
  if (hasPermission(permission)) {
    return children;
  }
  
  return fallback;
};

/**
 * Role Check - Conditional rendering based on minimum role level
 * Usage: <RoleCheck minRole="manager"><ManagerFeature /></RoleCheck>
 */
export const RoleCheck = ({ minRole, children, fallback = null }) => {
  const { hasMinimumRole } = usePermissions();
  
  if (hasMinimumRole(minRole)) {
    return children;
  }
  
  return fallback;
};

/**
 * Staff Actions - Shows limited actions available to staff
 */
export const StaffActionsInfo = () => {
  const { userRole, hasLimitedWrite } = usePermissions();
  
  if (!hasLimitedWrite()) return null;
  
  const actions = userRole === 'staff' 
    ? ['Create/Edit Invoices', 'Create/Edit Customers', 'Create/Edit Orders', 'Create Returns', 'Create/Edit Purchases']
    : ['Create Invoices', 'Create Customers', 'Create Returns'];
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4" data-testid="staff-actions-info">
      <p className="font-medium text-amber-800 mb-2 flex items-center gap-2">
        <Lock className="w-4 h-4" />
        Limited Access Mode
      </p>
      <p className="text-sm text-amber-700 mb-2">
        As a {userRole}, you can perform these actions:
      </p>
      <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
        {actions.map((action, idx) => (
          <li key={idx}>{action}</li>
        ))}
      </ul>
    </div>
  );
};

export default {
  ReadOnlyBanner,
  ActionGuard,
  RoleBadge,
  PermissionCheck,
  RoleCheck,
  StaffActionsInfo,
};
