import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar, 
  Package, 
  BarChart3, 
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navigationItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/daily-orders", icon: Calendar, label: "Daily Orders" },
  { href: "/item-management", icon: Package, label: "Item Management" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside 
      className={cn(
        "bg-card border-r border-border shadow-sm transition-all duration-300 ease-in-out relative",
        collapsed ? "w-16" : "w-64"
      )}
      data-testid="sidebar"
    >
      <div className="p-4 space-y-2">
        {!collapsed && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Navigation
            </h2>
          </div>
        )}
        
        {navigationItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  collapsed && "justify-center px-2"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className={cn("w-5 h-5", collapsed ? "w-6 h-6" : "w-5 h-5")} />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
        
        {!collapsed && <hr className="border-border my-4" />}
        
        {navigationItems.slice(3).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  collapsed && "justify-center px-2"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className={cn("w-5 h-5", collapsed ? "w-6 h-6" : "w-5 h-5")} />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      
      {/* Collapse toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-background shadow-md hover:bg-secondary"
        data-testid="button-collapse-sidebar"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>
    </aside>
  );
}
