import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Order, KITCHEN_STATUSES } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChefHat, CheckCircle, ArrowRight } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function KitchenDashboard() {
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState<string>(() => {
    return format(new Date(), "yyyy-MM-dd");
  });
  const [filterType, setFilterType] = useState<string>("today");
  const [previousOrderCount, setPreviousOrderCount] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  const { data: allOrders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/kitchen/orders", { date: filterType === "all" ? undefined : dateFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== "all" && dateFilter) {
        params.append("date", dateFilter);
      }
      const url = `/api/kitchen/orders${params.toString() ? `?${params.toString()}` : ""}`;
      
      // Get JWT token from localStorage
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      };
      
      const response = await fetch(url, {
        headers,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch kitchen orders");
      }
      return response.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds for new orders
  });

  // Detect new orders and show notification
  useEffect(() => {
    if (!allOrders || isLoading) return;
    
    const newOrderCount = allOrders.filter(order => order.kitchenStatus === "Pending").length;
    
    // On first load, just initialize the count without notification
    if (!isInitialized) {
      setPreviousOrderCount(newOrderCount);
      setIsInitialized(true);
      return;
    }
    
    // Show notification if order count increased
    if (newOrderCount > previousOrderCount) {
      const newOrdersAdded = newOrderCount - previousOrderCount;
      toast({
        title: "🔔 New Order Alert!",
        description: `${newOrdersAdded} new order${newOrdersAdded > 1 ? 's' : ''} received in kitchen`,
        duration: 5000,
      });
      
      // Play notification sound if browser supports it
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m58OScTgwOUKzk7bllHAU2jdXuy3otBSV9yO/glEILElmy5+ytWBUIRZze8L9vIgQmgMrt2YY1BxhntOrnnE4MDU+q4+uzYhoENIvT78p5LQUlfsjv35RCC");
        audio.volume = 0.3;
        audio.play().catch(() => {
          // Ignore audio play errors (browser may block autoplay)
        });
      } catch {
        // Ignore audio errors
      }
    }
    
    setPreviousOrderCount(newOrderCount);
  }, [allOrders, isLoading, isInitialized, previousOrderCount, toast]);

  // Reset tracking when filter changes to avoid false positives
  useEffect(() => {
    setIsInitialized(false);
    setPreviousOrderCount(0);
  }, [filterType, dateFilter]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest("PATCH", `/api/kitchen/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen/orders"] });
      toast({
        title: "Status Updated",
        description: "Order status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
    },
  });

  const getOrdersByStatus = (status: string) => {
    return allOrders.filter(order => order.kitchenStatus === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-500";
      case "Preparing":
        return "bg-blue-500";
      case "Ready to Serve":
        return "bg-green-500";
      case "Served":
        return "bg-gray-400";
      default:
        return "bg-gray-300";
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const statusIndex = KITCHEN_STATUSES.indexOf(currentStatus as any);
    if (statusIndex === -1 || statusIndex === KITCHEN_STATUSES.length - 1) {
      return null;
    }
    return KITCHEN_STATUSES[statusIndex + 1];
  };

  const getElapsedTime = (order: Order) => {
    let referenceTime: Date | null = null;
    
    switch (order.kitchenStatus) {
      case "Pending":
        referenceTime = order.kitchenReceivedAt ? new Date(order.kitchenReceivedAt) : new Date(order.createdAt || Date.now());
        break;
      case "Preparing":
        referenceTime = order.kitchenStartedAt ? new Date(order.kitchenStartedAt) : new Date(order.createdAt || Date.now());
        break;
      case "Ready to Serve":
        referenceTime = order.kitchenReadyAt ? new Date(order.kitchenReadyAt) : new Date(order.createdAt || Date.now());
        break;
      case "Served":
        referenceTime = order.kitchenServedAt ? new Date(order.kitchenServedAt) : new Date(order.createdAt || Date.now());
        break;
    }
    
    if (!referenceTime) return "Unknown";
    return formatDistanceToNow(referenceTime, { addSuffix: true });
  };

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, status: newStatus });
  };

  const handleFilterChange = (value: string) => {
    setFilterType(value);
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    switch (value) {
      case "today":
        setDateFilter(format(today, "yyyy-MM-dd"));
        break;
      case "yesterday":
        setDateFilter(format(yesterday, "yyyy-MM-dd"));
        break;
      case "all":
        setDateFilter("");
        break;
    }
  };

  const parseOrderItems = (itemsJson: string): any[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Kitchen Dashboard</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Loading orders...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl lg:text-5xl font-bold" data-testid="text-page-title">Kitchen Dashboard</h1>
          <p className="text-lg text-muted-foreground mt-2" data-testid="text-page-description">
            Live Order Preparation Monitor
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[200px] text-lg" data-testid="select-date-filter">
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" data-testid="select-item-today">Today</SelectItem>
              <SelectItem value="yesterday" data-testid="select-item-yesterday">Yesterday</SelectItem>
              <SelectItem value="all" data-testid="select-item-all">All Orders</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {KITCHEN_STATUSES.map((status) => {
          const orders = getOrdersByStatus(status);
          const statusColor = getStatusColor(status);
          
          return (
            <div key={status} className="flex flex-col" data-testid={`column-${status.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className={`${statusColor} text-white p-5 rounded-t-lg shadow-lg`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-3" data-testid={`text-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {status === "Pending" && <Clock className="h-7 w-7 lg:h-8 lg:w-8" />}
                    {status === "Preparing" && <ChefHat className="h-7 w-7 lg:h-8 lg:w-8" />}
                    {status === "Ready to Serve" && <CheckCircle className="h-7 w-7 lg:h-8 lg:w-8" />}
                    {status === "Served" && <CheckCircle className="h-7 w-7 lg:h-8 lg:w-8" />}
                    {status}
                  </h2>
                  <Badge variant="secondary" className="bg-white/30 text-white text-xl lg:text-2xl px-4 py-2 font-bold" data-testid={`badge-count-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {orders.length}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-muted/20 flex-1 p-5 rounded-b-lg space-y-4 min-h-[300px]">
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xl py-12" data-testid={`text-empty-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    No orders
                  </p>
                ) : (
                  orders.map((order) => {
                    const nextStatus = getNextStatus(order.kitchenStatus);
                    const items = parseOrderItems(order.items);
                    
                    return (
                      <Card key={order.id} className="hover:shadow-xl transition-shadow border-2" data-testid={`card-order-${order.id}`}>
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-2xl lg:text-3xl font-bold" data-testid={`text-order-number-${order.id}`}>
                                #{order.orderNumber}
                              </CardTitle>
                              {order.customerName && (
                                <p className="text-base lg:text-lg text-muted-foreground mt-1" data-testid={`text-customer-${order.id}`}>
                                  {order.customerName}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-sm lg:text-base px-3 py-1" data-testid={`badge-time-${order.id}`}>
                              <Clock className="h-4 w-4 mr-1" />
                              {getElapsedTime(order)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2" data-testid={`items-${order.id}`}>
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="text-base lg:text-lg flex justify-between py-1" data-testid={`item-${order.id}-${idx}`}>
                                <span className="font-semibold">{item.name}</span>
                                <span className="text-muted-foreground font-medium">
                                  {item.quantity} {item.unit || "x"}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          {nextStatus && (
                            <Button
                              size="lg"
                              className="w-full text-lg font-semibold"
                              onClick={() => handleStatusUpdate(order.id, nextStatus)}
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-next-status-${order.id}`}
                            >
                              {updateStatusMutation.isPending ? (
                                "Updating..."
                              ) : (
                                <>
                                  Move to {nextStatus}
                                  <ArrowRight className="ml-2 h-5 w-5" />
                                </>
                              )}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
