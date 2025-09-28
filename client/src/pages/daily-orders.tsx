import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOrderSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";
import { z } from "zod";

const orderFormSchema = insertOrderSchema.extend({
  items: z.string().min(1, "Items are required"),
});

export default function DailyOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: z.infer<typeof orderFormSchema>) => {
      const response = await apiRequest("POST", "/api/orders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Order created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest("DELETE", `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/orders/${orderId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
  });

  const form = useForm<z.infer<typeof orderFormSchema>>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderNumber: "",
      customerName: "",
      items: "",
      totalAmount: "",
      status: "pending",
    },
  });

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onSubmit = (values: z.infer<typeof orderFormSchema>) => {
    // Generate order number if not provided
    const orderNumber = values.orderNumber || `ORD-${Date.now()}`;
    createOrderMutation.mutate({
      ...values,
      orderNumber,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Daily Orders</h2>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-order">
              <Plus className="h-4 w-4 mr-2" />
              Create Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
              <DialogDescription>
                Add a new customer order to the system.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Auto-generated if empty"
                          data-testid="input-order-number"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter customer name"
                          data-testid="input-customer-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="items"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Items (JSON format)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder='[{"name": "Salmon", "quantity": 2, "price": 25.50}]'
                          data-testid="input-items"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-total-amount"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createOrderMutation.isPending}
                    data-testid="button-submit-order"
                  >
                    Create Order
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search orders by number or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-orders"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {orders.length === 0 ? (
                <div>
                  <p className="text-lg font-medium mb-2">No orders yet</p>
                  <p>Create your first order to get started.</p>
                </div>
              ) : (
                <p>No orders match your search criteria.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-view-items-${order.id}`}
                        onClick={() => {
                          try {
                            const items = JSON.parse(order.items);
                            const itemsList = items.map((item: any) => 
                              `${item.name} (${item.quantity}x)`
                            ).join(', ');
                            toast({
                              title: "Order Items",
                              description: itemsList || "No items found",
                            });
                          } catch {
                            toast({
                              title: "Order Items",
                              description: order.items,
                            });
                          }
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                    <TableCell>${order.totalAmount}</TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(status) => 
                          updateOrderStatusMutation.mutate({ orderId: order.id, status })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <Badge variant={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteOrderMutation.mutate(order.id)}
                        disabled={deleteOrderMutation.isPending}
                        data-testid={`button-delete-order-${order.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
