import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShoppingCart, 
  Fish, 
  DollarSign, 
  Package,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Order, Item } from "@shared/schema";

export default function Dashboard() {
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  // Calculate stats
  const totalOrders = orders.length;
  const totalItemsSold = orders.reduce((sum, order) => {
    try {
      const orderItems = JSON.parse(order.items);
      return sum + orderItems.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0);
    } catch {
      return sum;
    }
  }, 0);

  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
  const activeItems = items.filter(item => item.isActive === "true").length;

  // Get recent orders (last 5)
  const recentOrders = orders.slice(0, 5);

  // Get low stock items
  const lowStockItems = items
    .filter(item => item.stock < 10 && item.isActive === "true")
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);

  const getStockBadgeVariant = (stock: number) => {
    if (stock <= 3) return "destructive";
    if (stock <= 8) return "default";
    return "secondary";
  };

  const getStockLabel = (stock: number) => {
    if (stock <= 3) return "Critical";
    if (stock <= 8) return "Low";
    return "Medium";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
        <p className="text-muted-foreground">Welcome to your FishFire management dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-total-orders">
                  {totalOrders.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUp className="h-4 w-4 text-accent mr-1" />
              <span className="text-accent font-medium">+12.5%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items Sold</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-items-sold">
                  {totalItemsSold.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Fish className="h-6 w-6 text-accent" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUp className="h-4 w-4 text-accent mr-1" />
              <span className="text-accent font-medium">+8.1%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-revenue">
                  TK {totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUp className="h-4 w-4 text-accent mr-1" />
              <span className="text-accent font-medium">+15.3%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Items</p>
                <p className="text-2xl font-bold text-foreground" data-testid="stat-active-items">
                  {activeItems}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
              <span className="text-red-500 font-medium">-2.4%</span>
              <span className="text-muted-foreground ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No orders found. Create your first order to see it here.
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                    data-testid={`order-${order.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Fish className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">{order.customerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">TK {order.totalAmount}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                All items are well stocked. Great job!
              </div>
            ) : (
              <div className="space-y-4">
                {lowStockItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                    data-testid={`low-stock-${item.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.stock === 1 ? '1 unit left' : `${item.stock} units left`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStockBadgeVariant(item.stock)}>
                      {getStockLabel(item.stock)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
