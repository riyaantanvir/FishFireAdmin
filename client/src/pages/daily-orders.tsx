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
import { Search, Trash2, Plus, Eye } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Item } from "@shared/schema";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Order item schema
const orderItemSchema = z.object({
  itemId: z.string().min(1, "Please select an item"),
  name: z.string(),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price must be positive"),
  itemSaleType: z.string().optional(), // Per KG or Per PCS
  weightPerPCS: z.number().optional(), // Weight in KG for PCS items
  discountAmount: z.number().min(0, "Discount amount must be positive").optional(),
  discountPercentage: z.number().min(0).max(100, "Discount percentage must be between 0-100").optional(),
});

// Order form schema with order-level discounts
const orderFormSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  orderNumber: z.string().min(1, "Order number is required"),
  orderDate: z.string().min(1, "Order date is required"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  orderDiscountAmount: z.number().min(0, "Order discount amount must be positive").optional(),
  orderDiscountPercentage: z.number().min(0).max(100, "Order discount percentage must be between 0-100").optional(),
});

type OrderItem = z.infer<typeof orderItemSchema>;
type OrderForm = z.infer<typeof orderFormSchema>;

export default function DailyOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewOrderModal, setViewOrderModal] = useState<Order | null>(null);
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
    itemSaleType: "",
    weightPerPCS: 0,
    discountAmount: 0,
    discountPercentage: 0,
  }]);

  // Order-level discount state
  const [orderDiscountAmount, setOrderDiscountAmount] = useState(0);
  const [orderDiscountPercentage, setOrderDiscountPercentage] = useState(0);

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerName: "",
      orderNumber: `ORD-${Date.now()}`,
      orderDate: new Date().toISOString().split('T')[0],
      items: orderItems,
      orderDiscountAmount: 0,
      orderDiscountPercentage: 0,
    },
  });

  // Auto-calculate totals with order-level discounts
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    itemDiscounts: 0,
    subtotalAfterItemDiscounts: 0,
    orderDiscounts: 0,
    finalTotal: 0,
  });

  useEffect(() => {
    let subtotal = 0;
    let itemDiscounts = 0;

    // Calculate item-level totals and discounts
    orderItems.forEach(item => {
      if (item.quantity && item.price) {
        // Calculate base item total based on sale type
        let itemTotal = 0;
        if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
          // For Per PCS: Total = (Quantity * WeightPerPCS) * PricePerKG
          itemTotal = (item.quantity * item.weightPerPCS) * item.price;
        } else {
          // For Per KG: Total = Quantity * PricePerKG
          itemTotal = item.quantity * item.price;
        }
        
        subtotal += itemTotal;

        // Calculate item discount
        let itemDiscount = 0;
        if ((item.discountPercentage || 0) > 0) {
          itemDiscount = itemTotal * ((item.discountPercentage || 0) / 100);
        }
        if ((item.discountAmount || 0) > 0) {
          itemDiscount += (item.discountAmount || 0);
        }
        
        itemDiscounts += itemDiscount;
      }
    });

    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;

    // Calculate order-level discounts
    let orderDiscounts = 0;
    if (orderDiscountPercentage > 0) {
      orderDiscounts = subtotalAfterItemDiscounts * (orderDiscountPercentage / 100);
    }
    if (orderDiscountAmount > 0) {
      orderDiscounts += orderDiscountAmount;
    }

    const finalTotal = Math.max(0, subtotalAfterItemDiscounts - orderDiscounts);

    setOrderSummary({
      subtotal: Math.round(subtotal * 100) / 100,
      itemDiscounts: Math.round(itemDiscounts * 100) / 100,
      subtotalAfterItemDiscounts: Math.round(subtotalAfterItemDiscounts * 100) / 100,
      orderDiscounts: Math.round(orderDiscounts * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
    });

    // Update form with current values
    form.setValue("items", orderItems);
    form.setValue("orderDiscountAmount", orderDiscountAmount);
    form.setValue("orderDiscountPercentage", orderDiscountPercentage);
  }, [orderItems, orderDiscountAmount, orderDiscountPercentage, form]);

  // Add new item row
  const addItemRow = () => {
    setOrderItems([...orderItems, {
      itemId: "",
      name: "",
      quantity: 1,
      price: 0,
      itemSaleType: "",
      weightPerPCS: 0,
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

    // Auto-fill item name, price, sale type, and weight when item is selected
    if (field === 'itemId' && value) {
      const selectedItem = items.find(item => item.id === value);
      if (selectedItem) {
        newItems[index].name = selectedItem.name;
        // Use sellingPricePerKG as the base price for calculations
        newItems[index].price = parseFloat(selectedItem.sellingPricePerKG || selectedItem.price || "0");
        newItems[index].itemSaleType = selectedItem.itemSaleType || "Per KG";
        newItems[index].weightPerPCS = selectedItem.weightPerPCS ? parseFloat(selectedItem.weightPerPCS) : 0;
      }
    }

    setOrderItems(newItems);
  };

  // Calculate row total
  const getRowTotal = (item: OrderItem) => {
    if (!item.quantity || !item.price) return 0;
    
    // Calculate base total based on sale type
    let total = 0;
    if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
      // For Per PCS: Total = (Quantity * WeightPerPCS) * PricePerKG
      total = (item.quantity * item.weightPerPCS) * item.price;
    } else {
      // For Per KG: Total = Quantity * PricePerKG
      total = item.quantity * item.price;
    }
    
    // Apply percentage discount first
    if ((item.discountPercentage || 0) > 0) {
      total = total * (1 - (item.discountPercentage || 0) / 100);
    }
    
    // Then apply amount discount
    if ((item.discountAmount || 0) > 0) {
      total = Math.max(0, total - (item.discountAmount || 0));
    }
    
    return Math.round(total * 100) / 100;
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      // Format order data with order-level discounts
      const orderData = {
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        items: JSON.stringify({
          items: data.items,
          orderDiscountAmount: data.orderDiscountAmount || 0,
          orderDiscountPercentage: data.orderDiscountPercentage || 0,
        }),
        totalAmount: orderSummary.finalTotal.toString(),
        status: "pending",
        orderDate: data.orderDate,
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
        orderDiscountAmount: 0,
        orderDiscountPercentage: 0,
      });
      
      setOrderItems([{
        itemId: "",
        name: "",
        quantity: 1,
        price: 0,
        discountAmount: 0,
        discountPercentage: 0,
      }]);

      setOrderDiscountAmount(0);
      setOrderDiscountPercentage(0);
      
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

  // Parse order items with order-level discounts
  const parseOrderData = (itemsString: string) => {
    try {
      const parsed = JSON.parse(itemsString);
      // Handle both old format (array) and new format (object with items and discounts)
      if (Array.isArray(parsed)) {
        return { items: parsed, orderDiscountAmount: 0, orderDiscountPercentage: 0 };
      }
      return parsed;
    } catch {
      return { items: [], orderDiscountAmount: 0, orderDiscountPercentage: 0 };
    }
  };

  // Calculate order total for display
  const calculateOrderTotal = (itemsString: string) => {
    const orderData = parseOrderData(itemsString);
    let subtotal = 0;
    let itemDiscounts = 0;

    orderData.items.forEach((item: any) => {
      if (item.quantity && item.price) {
        const itemTotal = item.quantity * item.price;
        subtotal += itemTotal;

        let itemDiscount = 0;
        if (item.discountPercentage > 0) {
          itemDiscount = itemTotal * (item.discountPercentage / 100);
        }
        if (item.discountAmount > 0) {
          itemDiscount += item.discountAmount;
        }
        
        itemDiscounts += itemDiscount;
      }
    });

    const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
    
    let orderDiscounts = 0;
    if (orderData.orderDiscountPercentage > 0) {
      orderDiscounts = subtotalAfterItemDiscounts * (orderData.orderDiscountPercentage / 100);
    }
    if (orderData.orderDiscountAmount > 0) {
      orderDiscounts += orderData.orderDiscountAmount;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      itemDiscounts: Math.round(itemDiscounts * 100) / 100,
      subtotalAfterItemDiscounts: Math.round(subtotalAfterItemDiscounts * 100) / 100,
      orderDiscounts: Math.round(orderDiscounts * 100) / 100,
      finalTotal: Math.round((subtotalAfterItemDiscounts - orderDiscounts) * 100) / 100,
    };
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
        <p className="text-muted-foreground">Multi-item order management with full order discounts</p>
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
                          readOnly
                          className="bg-muted/50"
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
                        <TableHead>Sale Type</TableHead>
                        <TableHead>Weight/PCS</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Price/KG</TableHead>
                        <TableHead>Discount Amount</TableHead>
                        <TableHead>Discount %</TableHead>
                        <TableHead>Row Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item, index) => (
                        <TableRow key={index}>
                          {/* Item */}
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
                                    {availableItem.name} - {availableItem.itemSaleType || "Per KG"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          
                          {/* Sale Type */}
                          <TableCell>
                            <div className="text-sm font-medium text-muted-foreground">
                              {item.itemSaleType || "Per KG"}
                            </div>
                          </TableCell>
                          
                          {/* Weight per PCS */}
                          <TableCell>
                            {item.itemSaleType === "Per PCS" && item.weightPerPCS ? (
                              <div className="text-sm font-medium">
                                {item.weightPerPCS} KG
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">-</div>
                            )}
                          </TableCell>
                          
                          {/* Quantity */}
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
                          
                          {/* Price per KG */}
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price}
                              readOnly
                              className="w-24 bg-muted/50"
                              data-testid={`input-price-${index}`}
                            />
                          </TableCell>
                          
                          {/* Discount Amount */}
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
                          
                          {/* Discount Percentage */}
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
                          
                          {/* Row Total */}
                          <TableCell className="font-medium">
                            ${getRowTotal(item).toFixed(2)}
                          </TableCell>
                          
                          {/* Actions */}
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

              {/* Order-Level Discounts */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Order Discount</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Order Discount Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={orderDiscountAmount}
                      onChange={(e) => setOrderDiscountAmount(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      data-testid="input-order-discount-amount"
                    />
                  </div>
                  <div>
                    <Label>Order Discount %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={orderDiscountPercentage}
                      onChange={(e) => setOrderDiscountPercentage(Number(e.target.value) || 0)}
                      placeholder="0"
                      data-testid="input-order-discount-percentage"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Subtotal</Label>
                  <div className="text-lg font-medium">${orderSummary.subtotal.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Item Discounts</Label>
                  <div className="text-lg font-medium text-red-600">-${orderSummary.itemDiscounts.toFixed(2)}</div>
                </div>
                <div>
                  <Label>After Item Discounts</Label>
                  <div className="text-lg font-medium">${orderSummary.subtotalAfterItemDiscounts.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Order Discounts</Label>
                  <div className="text-lg font-medium text-red-600">-${orderSummary.orderDiscounts.toFixed(2)}</div>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Final Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 
                       order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">${order.totalAmount}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewOrderModal(order)}
                          data-testid={`button-view-order-${order.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteOrderMutation.mutate(order.id)}
                          disabled={deleteOrderMutation.isPending}
                          data-testid={`button-delete-order-${order.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Order Modal */}
      <Dialog open={!!viewOrderModal} onOpenChange={() => setViewOrderModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete order information and breakdown
            </DialogDescription>
          </DialogHeader>
          {viewOrderModal && (
            <div className="space-y-6">
              {/* Order Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Customer Name</Label>
                  <div className="font-medium">{viewOrderModal.customerName}</div>
                </div>
                <div>
                  <Label>Order Number</Label>
                  <div className="font-medium">{viewOrderModal.orderNumber}</div>
                </div>
                <div>
                  <Label>Order Date</Label>
                  <div className="font-medium">
                    {viewOrderModal.orderDate ? new Date(viewOrderModal.orderDate).toLocaleDateString() :
                     viewOrderModal.createdAt ? new Date(viewOrderModal.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Order Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Discounts</TableHead>
                      <TableHead>Row Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseOrderData(viewOrderModal.items).items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.price}</TableCell>
                        <TableCell>
                          {item.discountAmount > 0 && `TK ${item.discountAmount}`}
                          {item.discountAmount > 0 && item.discountPercentage > 0 && " + "}
                          {item.discountPercentage > 0 && `${item.discountPercentage}%`}
                          {!item.discountAmount && !item.discountPercentage && "None"}
                        </TableCell>
                        <TableCell>
                          ${((item.quantity * item.price) - 
                            (item.discountAmount || 0) - 
                            (item.quantity * item.price * (item.discountPercentage || 0) / 100)).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Order Summary */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
                {(() => {
                  const totals = calculateOrderTotal(viewOrderModal.items);
                  const orderData = parseOrderData(viewOrderModal.items);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div>
                        <Label>Subtotal</Label>
                        <div className="text-lg font-medium">${totals.subtotal.toFixed(2)}</div>
                      </div>
                      <div>
                        <Label>Item Discounts</Label>
                        <div className="text-lg font-medium text-red-600">-${totals.itemDiscounts.toFixed(2)}</div>
                      </div>
                      <div>
                        <Label>After Item Discounts</Label>
                        <div className="text-lg font-medium">${totals.subtotalAfterItemDiscounts.toFixed(2)}</div>
                      </div>
                      <div>
                        <Label>Order Discounts</Label>
                        <div className="text-lg font-medium text-red-600">
                          -${totals.orderDiscounts.toFixed(2)}
                          {(orderData.orderDiscountAmount > 0 || orderData.orderDiscountPercentage > 0) && (
                            <div className="text-sm text-muted-foreground">
                              {orderData.orderDiscountAmount > 0 && `TK ${orderData.orderDiscountAmount}`}
                              {orderData.orderDiscountAmount > 0 && orderData.orderDiscountPercentage > 0 && " + "}
                              {orderData.orderDiscountPercentage > 0 && `${orderData.orderDiscountPercentage}%`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Final Total</Label>
                        <div className="text-xl font-bold">${totals.finalTotal.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}