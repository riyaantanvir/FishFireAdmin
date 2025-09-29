import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar, 
  Package, 
  ClipboardList, 
  BarChart3, 
  Settings,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  isMobile: boolean;
}

const navigationItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/daily-orders", icon: Calendar, label: "Daily Orders" },
  { href: "/item-management", icon: Package, label: "Item Management" },
  { href: "/order-management", icon: ClipboardList, label: "Order Management" },
  { href: "/expense-management", icon: DollarSign, label: "Expense Management" },
  { href: "/stock-reconciliation", icon: Scale, label: "Stock Reconciliation" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ open, onToggle, onClose, isMobile }: SidebarProps) {
  const [location] = useLocation();

  return (
    <aside 
      className={cn(
        "bg-card border-r border-border shadow-sm transition-all duration-300 ease-in-out relative",
        isMobile 
          ? `fixed top-16 left-0 h-[calc(100vh-64px)] z-50 ${open ? "w-64 translate-x-0" : "w-64 -translate-x-full"}`
          : `${open ? "w-64" : "w-16"}`
      )}
      data-testid="sidebar"
    >
      <div className="p-4 space-y-2">
        {(isMobile || open) && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Navigation
            </h2>
          </div>
        )}
        
        {navigationItems.slice(0, 6).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href} onClick={isMobile ? onClose : undefined}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-3 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  (!open && !isMobile) && "justify-center px-2"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className={cn("w-5 h-5", (!open && !isMobile) ? "w-6 h-6" : "w-5 h-5")} />
                {(open || isMobile) && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
        
        {(isMobile || open) && <hr className="border-border my-4" />}
        
        {navigationItems.slice(6).map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link key={item.href} href={item.href} onClick={isMobile ? onClose : undefined}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-3 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  (!open && !isMobile) && "justify-center px-2"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <Icon className={cn("w-5 h-5", (!open && !isMobile) ? "w-6 h-6" : "w-5 h-5")} />
                {(open || isMobile) && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      
      {/* Collapse toggle button - only on desktop */}
      {!isMobile && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-background shadow-md hover:bg-secondary"
          data-testid="button-collapse-sidebar"
        >
          {open ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      )}
    </aside>
  );
}
