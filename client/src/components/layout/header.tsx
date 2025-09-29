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
    <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="flex items-center justify-between px-3 py-3 sm:px-4">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            data-testid="button-toggle-sidebar"
            className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Fish className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
              <span className="hidden sm:inline">FishFire Management</span>
              <span className="sm:hidden">FishFire</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span data-testid="text-welcome">Welcome, {user?.username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
            className="h-10 px-3 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
