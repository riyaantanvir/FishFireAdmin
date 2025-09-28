import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Fish, Menu, User, LogOut } from "lucide-react";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            data-testid="button-toggle-sidebar"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-3">
            <Fish className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">FishFire Management</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span data-testid="text-welcome">Welcome, {user?.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
            className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="mr-1 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
