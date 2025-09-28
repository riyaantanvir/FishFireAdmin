import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Item } from "@shared/schema";
import { z } from "zod";

// Form schema for the inline order entry
const orderEntrySchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  selectedItemId: z.string().min(1, "Please select an item"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price must be positive"),
  discountAmount: z.number().min(0, "Discount amount must be positive").optional(),
  discountPercentage: z.number().min(0).max(100, "Discount percentage must be between 0-100").optional(),
});

type OrderEntryForm = z.infer<typeof orderEntrySchema>;

export default function DailyOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  // Fetch orders and items
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const form = useForm<OrderEntryForm>({
    resolver: zodResolver(orderEntrySchema),
    defaultValues: {
      customerName: "",
      selectedItemId: "",
      quantity: 1,
      price: 0,
      discountAmount: 0,
      discountPercentage: 0,
    },
  });

  // Watch form values for auto-calculation
  const watchedValues = form.watch();
  const [finalTotal, setFinalTotal] = useState(0);

  // Auto-calculate final total when values change
  useEffect(() => {
    const { quantity, price, discountAmount = 0, discountPercentage = 0 } = watchedValues;
    
    if (quantity && price) {
      let total = quantity * price;
      
      // Apply percentage discount first
      if (discountPercentage > 0) {
        total = total * (1 - discountPercentage / 100);
      }
      
      // Then apply amount discount
      if (discountAmount > 0) {
        total = Math.max(0, total - discountAmount);
      }
      
      setFinalTotal(Math.round(total * 100) / 100);
    }
  }, [watchedValues]);

  // Auto-fill price when item is selected
  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find(item => item.id === itemId);
    if (selectedItem) {
      form.setValue("price", parseFloat(selectedItem.price));
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderEntryForm) => {
      const selectedItem = items.find(item => item.id === data.selectedItemId);
      
      // Format order data
      const orderData = {
        orderNumber: `ORD-${Date.now()}`,
        customerName: data.customerName,
        items: JSON.stringify([{
          id: data.selectedItemId,
          name: selectedItem?.name || "Unknown Item",
          quantity: data.quantity,
          price: data.price,
          discountAmount: data.discountAmount || 0,
          discountPercentage: data.discountPercentage || 0,
        }]),
        totalAmount: finalTotal.toString(),
        status: "pending",
      };

      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      form.reset({
        customerName: "",
        selectedItemId: "",
        quantity: 1,
        price: 0,
        discountAmount: 0,
        discountPercentage: 0,
      });
      setFinalTotal(0);
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onSubmit = (values: OrderEntryForm) => {
    if (finalTotal <= 0) {
      toast({
        title: "Error",
        description: "Total amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }
    createOrderMutation.mutate(values);
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

  const formatOrderItems = (itemsString: string) => {
    try {
      const items = JSON.parse(itemsString);
      return items.map((item: any) => 
        `${item.name} (${item.quantity}x @ ${item.price})`
      ).join(', ');
    } catch {
      return itemsString;
    }
  };

  const getOrderDiscount = (itemsString: string) => {
    try {
      const items = JSON.parse(itemsString);
      const item = items[0]; // Assuming single item orders for now
      if (item?.discountAmount > 0) {
        return `TK ${item.discountAmount}`;
      } else if (item?.discountPercentage > 0) {
        return `${item.discountPercentage}%`;
      }
      return "None";
    } catch {
      return "None";
    }
  };

  if (ordersLoading || itemsLoading) {
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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Daily Orders</h2>
        <p className="text-muted-foreground">Quick order entry and management</p>
      </div>

      {/* Inline Order Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Customer Name */}
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

                {/* Select Item */}
                <FormField
                  control={form.control}
                  name="selectedItemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Item</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        handleItemSelect(value);
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item">
                            <SelectValue placeholder="Choose an item" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {items.filter(item => item.isActive === "true").map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} - ${item.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quantity */}
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="1"
                          placeholder="1"
                          data-testid="input-quantity"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (per unit)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          data-testid="input-price"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Discount Amount */}
                <FormField
                  control={form.control}
                  name="discountAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Amount (TK)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          data-testid="input-discount-amount"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Discount Percentage */}
                <FormField
                  control={form.control}
                  name="discountPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Percentage (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="0"
                          data-testid="input-discount-percentage"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Final Total (Display Only) */}
                <div className="space-y-2">
                  <Label>Final Total</Label>
                  <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center font-medium text-lg">
                    ${finalTotal.toFixed(2)}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-end">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={createOrderMutation.isPending}
                    data-testid="button-create-order"
                  >
                    Create Order
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Search and Filter */}
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
                  <p>Create your first order using the form above.</p>
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
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Final Total</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {formatOrderItems(order.items)}
                    </TableCell>
                    <TableCell>{getOrderDiscount(order.items)}</TableCell>
                    <TableCell className="font-medium">${order.totalAmount}</TableCell>
                    <TableCell>
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                    </TableCell>
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