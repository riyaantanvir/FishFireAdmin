import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import DailyOrders from "@/pages/daily-orders";
import ItemManagement from "@/pages/item-management";
import OrderManagement from "@/pages/order-management";
import ExpenseManagement from "@/pages/expense-management";
import StockReconciliation from "@/pages/stock-reconciliation";
import Reports from "@/pages/reports";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={toggleSidebar} />
      <div className="flex">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main className="flex-1 p-6 transition-all duration-300 ease-in-out">
          {children}
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
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">Settings</h2>
              <p className="text-muted-foreground">Settings feature coming soon!</p>
            </div>
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
