import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import React, { useState } from "react";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import DailyOrders from "@/pages/daily-orders";
import ItemManagement from "@/pages/item-management";
import OrderManagement from "@/pages/order-management";
import ExpenseManagement from "@/pages/expense-management";
import StockReconciliation from "@/pages/stock-reconciliation";
import UserManagement from "@/pages/user-management";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={toggleSidebar} />
      <div className="flex relative">
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeSidebar}
          />
        )}
        
        <Sidebar 
          open={sidebarOpen} 
          onToggle={toggleSidebar}
          onClose={closeSidebar}
          isMobile={isMobile}
        />
        
        <main className={`
          flex-1 transition-all duration-300 ease-in-out
          ${isMobile ? 'p-4' : 'p-6'}
          ${isMobile ? 'min-h-[calc(100vh-64px)]' : 'min-h-[calc(100vh-72px)]'}
          overflow-x-auto
        `}>
          <div className="w-full max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute 
        path="/" 
        component={() => (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/daily-orders" 
        component={() => (
          <DashboardLayout>
            <DailyOrders />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/item-management" 
        component={() => (
          <DashboardLayout>
            <ItemManagement />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/order-management" 
        component={() => (
          <DashboardLayout>
            <OrderManagement />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/expense-management" 
        component={() => (
          <DashboardLayout>
            <ExpenseManagement />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/stock-reconciliation" 
        component={() => (
          <DashboardLayout>
            <StockReconciliation />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/user-management" 
        component={() => (
          <DashboardLayout>
            <UserManagement />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/reports" 
        component={() => (
          <DashboardLayout>
            <Reports />
          </DashboardLayout>
        )} 
      />
      <ProtectedRoute 
        path="/settings" 
        component={() => (
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        )} 
      />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
