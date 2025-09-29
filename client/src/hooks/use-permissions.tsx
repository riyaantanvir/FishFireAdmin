import { useQuery } from "@tanstack/react-query";

interface UserPermissions {
  permissions: string[];
}

export function usePermissions() {
  const { data: userPermissions } = useQuery<UserPermissions>({
    queryKey: ["/api/user/permissions"],
    enabled: true,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const hasPermission = (permission: string): boolean => {
    return userPermissions?.permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  // Resource-based permission helpers
  const canView = (resource: string): boolean => hasPermission(`view:${resource}`);
  const canCreate = (resource: string): boolean => hasPermission(`create:${resource}`);
  const canEdit = (resource: string): boolean => hasPermission(`edit:${resource}`);
  const canDelete = (resource: string): boolean => hasPermission(`delete:${resource}`);
  const canExport = (resource: string): boolean => hasPermission(`export:${resource}`);

  return {
    permissions: userPermissions?.permissions || [],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
  };
}

// Component wrapper for conditional rendering based on permissions
interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ 
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children 
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}