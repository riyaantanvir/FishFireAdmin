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
import { Search, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Item } from "@shared/schema";
import { z } from "zod";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Order item schema
const orderItemSchema = z.object({
  itemId: z.string().min(1, "Please select an item"),
  name: z.string(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price must be positive"),
  discountAmount: z.number().min(0, "Discount amount must be positive").optional(),
  discountPercentage: z.number().min(0).max(100, "Discount percentage must be between 0-100").optional(),
});

// Order form schema
const orderFormSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  orderNumber: z.string().min(1, "Order number is required"),
  orderDate: z.string().min(1, "Order date is required"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
});

type OrderItem = z.infer<typeof orderItemSchema>;
type OrderForm = z.infer<typeof orderFormSchema>;

export default function DailyOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch orders and items
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  // Order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{
    itemId: "",
    name: "",
    quantity: 1,
    price: 0,
    discountAmount: 0,
    discountPercentage: 0,
  }]);

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: "",
      orderNumber: `ORD-${Date.now()}`,
      orderDate: new Date().toISOString().split('T')[0],
      items: orderItems,
    },
  });

  // Auto-calculate totals
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    totalDiscount: 0,
    finalTotal: 0,
  });

  useEffect(() => {
    let subtotal = 0;
    let totalDiscount = 0;

    orderItems.forEach(item => {
      if (item.quantity && item.price) {
        const itemTotal = item.quantity * item.price;
        subtotal += itemTotal;

        // Calculate item discount
        let itemDiscount = 0;
        if (item.discountPercentage > 0) {
          itemDiscount = itemTotal * (item.discountPercentage / 100);
        }
        if (item.discountAmount > 0) {
          itemDiscount += item.discountAmount;
        }
        
        totalDiscount += itemDiscount;
      }
    });

    const finalTotal = Math.max(0, subtotal - totalDiscount);

    setOrderSummary({
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
    });

    // Update form with current items
    form.setValue("items", orderItems);
  }, [orderItems, form]);

  // Add new item row
  const addItemRow = () => {
    setOrderItems([...orderItems, {
      itemId: "",
      name: "",
      quantity: 1,
      price: 0,
      discountAmount: 0,
      discountPercentage: 0,
    }]);
  };

  // Remove item row
  const removeItemRow = (index: number) => {
    if (orderItems.length > 1) {
      const newItems = orderItems.filter((_, i) => i !== index);
      setOrderItems(newItems);
    }
  };

  // Update item in state
  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill item name and price when item is selected
    if (field === 'itemId' && value) {
      const selectedItem = items.find(item => item.id === value);
      if (selectedItem) {
        newItems[index].name = selectedItem.name;
        newItems[index].price = parseFloat(selectedItem.price);
      }
    }

    setOrderItems(newItems);
  };

  // Calculate row total
  const getRowTotal = (item: OrderItem) => {
    if (!item.quantity || !item.price) return 0;
    
    let total = item.quantity * item.price;
    
    // Apply percentage discount first
    if (item.discountPercentage > 0) {
      total = total * (1 - item.discountPercentage / 100);
    }
    
    // Then apply amount discount
    if (item.discountAmount > 0) {
      total = Math.max(0, total - item.discountAmount);
    }
    
    return Math.round(total * 100) / 100;
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      // Format order data
      const orderData = {
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        items: JSON.stringify(data.items),
        totalAmount: orderSummary.finalTotal.toString(),
        status: "pending",
      };

      const response = await apiRequest("POST", "/api/orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      
      // Reset form
      const newOrderNumber = `ORD-${Date.now()}`;
      form.reset({
        customerName: "",
        orderNumber: newOrderNumber,
        orderDate: new Date().toISOString().split('T')[0],
        items: [],
      });
      
      setOrderItems([{
        itemId: "",
        name: "",
        quantity: 1,
        price: 0,
        discountAmount: 0,
        discountPercentage: 0,
      }]);
      
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

  const onSubmit = (values: OrderForm) => {
    if (orderSummary.finalTotal <= 0) {
      toast({
        title: "Error",
        description: "Total amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }
    
    if (orderItems.some(item => !item.itemId)) {
      toast({
        title: "Error",
        description: "Please select an item for all rows",
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
        `${item.name} (${item.quantity}x)`
      ).join(', ');
    } catch {
      return itemsString;
    }
  };

  const parseOrderItems = (itemsString: string) => {
    try {
      return JSON.parse(itemsString);
    } catch {
      return [];
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
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
        <p className="text-muted-foreground">Multi-item order management</p>
      </div>

      {/* Order Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Order Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
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
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Auto-generated"
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
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          data-testid="input-order-date"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Order Items Table */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Order Items</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addItemRow}
                    data-testid="button-add-item"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Discount Amount</TableHead>
                        <TableHead>Discount %</TableHead>
                        <TableHead>Row Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Select 
                              value={item.itemId} 
                              onValueChange={(value) => updateOrderItem(index, 'itemId', value)}
                            >
                              <SelectTrigger data-testid={`select-item-${index}`}>
                                <SelectValue placeholder="Choose an item" />
                              </SelectTrigger>
                              <SelectContent>
                                {items.filter(i => i.isActive).map((availableItem) => (
                                  <SelectItem key={availableItem.id} value={availableItem.id}>
                                    {availableItem.name} - ${availableItem.price}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                              data-testid={`input-quantity-${index}`}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              onChange={(e) => updateOrderItem(index, 'price', Number(e.target.value))}
                              data-testid={`input-price-${index}`}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.discountAmount || 0}
                              onChange={(e) => updateOrderItem(index, 'discountAmount', Number(e.target.value) || 0)}
                              data-testid={`input-discount-amount-${index}`}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.discountPercentage || 0}
                              onChange={(e) => updateOrderItem(index, 'discountPercentage', Number(e.target.value) || 0)}
                              data-testid={`input-discount-percentage-${index}`}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            ${getRowTotal(item).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItemRow(index)}
                              disabled={orderItems.length === 1}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Order Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Subtotal</Label>
                  <div className="text-lg font-medium">${orderSummary.subtotal.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Total Discount</Label>
                  <div className="text-lg font-medium text-red-600">-${orderSummary.totalDiscount.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Final Order Total</Label>
                  <div className="text-xl font-bold">${orderSummary.finalTotal.toFixed(2)}</div>
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full"
                disabled={createOrderMutation.isPending}
                data-testid="button-submit-order"
              >
                Create Order
              </Button>
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
            <div className="space-y-2">
              {filteredOrders.map((order) => (
                <Collapsible key={order.id}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {expandedOrders.has(order.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <div>
                              <h4 className="font-semibold">{order.orderNumber}</h4>
                              <p className="text-sm text-muted-foreground">{order.customerName}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-medium">${order.totalAmount}</p>
                              <p className="text-sm text-muted-foreground">
                                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <Badge variant={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                            <div className="flex space-x-2">
                              <Select
                                value={order.status}
                                onValueChange={(status) => 
                                  updateOrderStatusMutation.mutate({ orderId: order.id, status })
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteOrderMutation.mutate(order.id);
                                }}
                                disabled={deleteOrderMutation.isPending}
                                data-testid={`button-delete-order-${order.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent
                      onClick={() => toggleOrderExpansion(order.id)}
                    >
                      <CardContent>
                        <h5 className="font-medium mb-2">Order Items:</h5>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Discount</TableHead>
                              <TableHead>Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parseOrderItems(order.items).map((item: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>${item.price}</TableCell>
                                <TableCell>
                                  {item.discountAmount > 0 && `TK ${item.discountAmount}`}
                                  {item.discountPercentage > 0 && `${item.discountPercentage}%`}
                                  {!item.discountAmount && !item.discountPercentage && "None"}
                                </TableCell>
                                <TableCell>
                                  ${((item.quantity * item.price) - (item.discountAmount || 0) - (item.quantity * item.price * (item.discountPercentage || 0) / 100)).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}