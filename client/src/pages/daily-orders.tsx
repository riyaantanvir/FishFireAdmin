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
import { Search, Trash2, Plus, Eye, DollarSign, Calendar, ShoppingCart, Receipt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import type { Order, Item, Payment, InsertPayment } from "@shared/schema";
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
  liveWeight: z.number().min(0.001, "Live weight must be greater than 0"),
  price: z.number().min(0, "Price must be positive"),
  itemSaleType: z.string().optional(), // Per KG or Per PCS
  weightPerPCS: z.number().optional(), // Weight in KG for PCS items
});

// Order form schema with order-level discounts
const orderFormSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  orderDate: z.string().min(1, "Order date is required"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  orderDiscountAmount: z.number().min(0, "Order discount amount must be positive").optional(),
  orderDiscountPercentage: z.number().min(0).max(100, "Order discount percentage must be between 0-100").optional(),
});

// Payment form schema - simplified
const paymentFormSchema = z.object({
  // Cash payment
  cash: z.number().min(0).default(0),
  // Digital payments
  bkash: z.number().min(0).default(0),
  rocket: z.number().min(0).default(0),
  nogod: z.number().min(0).default(0),
  card: z.number().min(0).default(0),
  bank: z.number().min(0).default(0),
});

type OrderItem = z.infer<typeof orderItemSchema>;
type OrderForm = z.infer<typeof orderFormSchema>;
type PaymentForm = z.infer<typeof paymentFormSchema>;

// Helper function to filter orders by last 2 days (today and yesterday only)
const filterOrdersByDays = (orders: Order[], days: number = 2): Order[] => {
  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(today.getDate() - (days - 1)); // For 2 days: today and yesterday only
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  return orders.filter(order => {
    const orderDate = order.orderDate;
    return orderDate >= cutoffDateStr;
  });
};

export default function DailyOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewOrderModal, setViewOrderModal] = useState<Order | null>(null);
  const [paymentModal, setPaymentModal] = useState<Order | null>(null);
  const { toast } = useToast();
  const { canView, canCreate, canDelete } = usePermissions();
  const { user } = useAuth();

  // Fetch orders and items
  const { data: allOrders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: canView("orders"), // Only fetch if user can view orders
  });

  // Filter orders to show only last 2 days for Daily Orders
  const orders = filterOrdersByDays(allOrders, 2);

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
    enabled: canView("items"), // Only fetch if user can view items
  });

  // Order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{
    itemId: "",
    name: "",
    liveWeight: 1,
    price: 0,
    itemSaleType: "",
    weightPerPCS: 0,
  }]);

  // Order-level discount state
  const [orderDiscountAmount, setOrderDiscountAmount] = useState(0);
  const [orderDiscountPercentage, setOrderDiscountPercentage] = useState(0);

  const form = useForm<OrderForm>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
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
    orderDiscounts: 0,
    finalTotal: 0,
  });

  useEffect(() => {
    let subtotal = 0;

    // Calculate item-level totals
    orderItems.forEach(item => {
      if (item.liveWeight && item.price) {
        // Calculate base item total based on sale type
        let itemTotal = 0;
        if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
          // For Per PCS with weightPerPCS: Total = ((LiveWeight in grams / 1000) * WeightPerPCS) * PricePerKG
          itemTotal = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
        } else if (item.itemSaleType === "Per PCS") {
          // For Per PCS without weightPerPCS: Total = LiveWeight * PricePerPCS (no division)
          itemTotal = item.liveWeight * item.price;
        } else {
          // For Per KG: Total = (LiveWeight in grams / 1000) * PricePerKG
          itemTotal = (item.liveWeight / 1000) * item.price;
        }
        
        subtotal += itemTotal;
      }
    });

    // Calculate order-level discounts
    let orderDiscounts = 0;
    if (orderDiscountPercentage > 0) {
      orderDiscounts = subtotal * (orderDiscountPercentage / 100);
    }
    if (orderDiscountAmount > 0) {
      orderDiscounts += orderDiscountAmount;
    }

    const finalTotal = Math.max(0, subtotal - orderDiscounts);

    setOrderSummary({
      subtotal: Math.round(subtotal * 100) / 100,
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
      liveWeight: 1,
      price: 0,
      itemSaleType: "",
      weightPerPCS: 0,
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
    if (!item.liveWeight || !item.price) return 0;
    
    // Calculate base total based on sale type
    let total = 0;
    if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
      // For Per PCS with weightPerPCS: Total = ((LiveWeight in grams / 1000) * WeightPerPCS) * PricePerKG
      total = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
    } else if (item.itemSaleType === "Per PCS") {
      // For Per PCS without weightPerPCS: Total = LiveWeight * PricePerPCS (no division)
      total = item.liveWeight * item.price;
    } else {
      // For Per KG: Total = (LiveWeight in grams / 1000) * PricePerKG
      total = (item.liveWeight / 1000) * item.price;
    }
    
    return Math.round(total * 100) / 100;
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderForm) => {
      // Format order data with order-level discounts
      const orderData = {
        orderNumber: data.orderNumber,
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
        orderNumber: newOrderNumber,
        orderDate: new Date().toISOString().split('T')[0],
        items: [],
        orderDiscountAmount: 0,
        orderDiscountPercentage: 0,
      });
      
      setOrderItems([{
        itemId: "",
        name: "",
        liveWeight: 1,
        price: 0,
        itemSaleType: "",
        weightPerPCS: 0,
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

  // Payment form
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      cash: 0,
      bkash: 0,
      rocket: 0,
      nogod: 0,
      card: 0,
      bank: 0,
    },
  });

  // Payment mutations
  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: InsertPayment) => {
      return await apiRequest("POST", "/api/payments", paymentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-reports"] });
      setPaymentModal(null);
      paymentForm.reset();
      toast({
        title: "Success",
        description: "Payment recorded successfully",
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

  const updateOrderPaymentMutation = useMutation({
    mutationFn: async ({ orderId, paymentStatus }: { orderId: string; paymentStatus: string }) => {
      return await apiRequest("PUT", `/api/orders/${orderId}`, { paymentStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Payment handlers
  const handlePaymentStatusChange = (order: Order, status: string) => {
    if (status === "Paid") {
      setPaymentModal(order);
    } else {
      updateOrderPaymentMutation.mutate({ orderId: order.id, paymentStatus: status });
    }
  };

  // Calculate cash total
  const calculateCashTotal = (formData: PaymentForm) => {
    return formData.cash || 0;
  };

  // Calculate digital total
  const calculateDigitalTotal = (formData: PaymentForm) => {
    return formData.bkash + formData.rocket + formData.nogod + formData.card + formData.bank;
  };

  // Handle payment submission
  const handlePaymentSubmit = (data: PaymentForm) => {
    if (!paymentModal) return;

    const totalCash = calculateCashTotal(data);
    const totalDigital = calculateDigitalTotal(data);
    const totalPaid = totalCash + totalDigital;

    const paymentData: InsertPayment = {
      orderId: paymentModal.id,
      orderNumber: paymentModal.orderNumber,
      customerName: "Customer", // Default since customer name is no longer collected
      orderTotal: paymentModal.totalAmount,
      totalPaid: totalPaid.toString(),
      cash1000: 0,
      cash500: 0,
      cash200: 0,
      cash100: 0,
      cash50: 0,
      cash20: 0,
      cash10: 0,
      cash5: 0,
      cash2: 0,
      cash1: 0,
      totalCash: totalCash.toString(),
      bkash: data.bkash.toString(),
      rocket: data.rocket.toString(),
      nogod: data.nogod.toString(),
      card: data.card.toString(),
      bank: data.bank.toString(),
      totalDigital: totalDigital.toString(),
      paymentDate: new Date().toISOString().split('T')[0],
    };

    createPaymentMutation.mutate(paymentData);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase());
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

    orderData.items.forEach((item: any) => {
      if (item.liveWeight && item.price) {
        // Calculate total based on sale type
        let itemTotal = 0;
        if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
          // For Per PCS with weightPerPCS: Total = ((LiveWeight in grams / 1000) * WeightPerPCS) * PricePerKG
          itemTotal = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
        } else if (item.itemSaleType === "Per PCS") {
          // For Per PCS without weightPerPCS: Total = LiveWeight * PricePerPCS (no division)
          itemTotal = item.liveWeight * item.price;
        } else {
          // For Per KG: Total = (LiveWeight in grams / 1000) * PricePerKG
          itemTotal = (item.liveWeight / 1000) * item.price;
        }
        subtotal += itemTotal;
      }
    });

    let orderDiscounts = 0;
    if (orderData.orderDiscountPercentage > 0) {
      orderDiscounts = subtotal * (orderData.orderDiscountPercentage / 100);
    }
    if (orderData.orderDiscountAmount > 0) {
      orderDiscounts += orderData.orderDiscountAmount;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      orderDiscounts: Math.round(orderDiscounts * 100) / 100,
      finalTotal: Math.round((subtotal - orderDiscounts) * 100) / 100,
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Daily Orders</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Multi-item order management with full order discounts</p>
      </div>

      {/* Order Entry Form */}
      <div className="space-y-4 sm:space-y-6">
        {/* Sticky Order Summary - Mobile */}
        <div className="sticky top-16 z-40 lg:hidden">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Order Total</span>
                <Badge variant="secondary" className="text-sm font-bold">
                  TK {orderSummary.finalTotal.toFixed(2)}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">Create New Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Order Header - Mobile-Responsive */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Order Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                  <FormField
                    control={form.control}
                    name="orderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Order Number</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Auto-generated"
                            data-testid="input-order-number"
                            readOnly
                            className="bg-muted/50 h-11 sm:h-10"
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
                        <FormLabel className="text-sm font-medium">Order Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            data-testid="input-order-date"
                            className="h-11 sm:h-10"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="text-base font-semibold flex items-center">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Order Items ({orderItems.length})
                  </h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addItemRow}
                    data-testid="button-add-item"
                    className="w-full sm:w-auto h-11 sm:h-9"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
                
                {/* Mobile Card Layout */}
                <div className="space-y-4 lg:hidden">
                  {orderItems.map((item, index) => (
                    <Card key={index} className="p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Item</Label>
                          <Select 
                            value={item.itemId} 
                            onValueChange={(value) => updateOrderItem(index, 'itemId', value)}
                          >
                            <SelectTrigger data-testid={`select-item-${index}`} className="mt-1 h-11">
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
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItemRow(index)}
                          data-testid={`button-remove-item-${index}`}
                          className="ml-2 h-11 w-11 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Sale Type</Label>
                          <div className="mt-1 text-sm font-medium text-muted-foreground p-2 bg-muted/50 rounded-md">
                            {item.itemSaleType || "Per KG"}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Weight/PCS</Label>
                          <div className="mt-1 text-sm font-medium p-2 bg-muted/50 rounded-md">
                            {item.itemSaleType === "Per PCS" && item.weightPerPCS ? (
                              `${item.weightPerPCS} KG`
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">
                            Live Weight ({item.itemSaleType === "Per PCS" ? "PCS" : "gm"})
                          </Label>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            value={item.itemSaleType === "Per PCS" ? item.liveWeight : Math.round((item.liveWeight || 0) * 1000)}
                            onChange={(e) => {
                              const inputValue = Number(e.target.value);
                              const kgValue = item.itemSaleType === "Per PCS" ? inputValue : inputValue / 1000;
                              updateOrderItem(index, 'liveWeight', kgValue);
                            }}
                            data-testid={`input-live-weight-${index}`}
                            className="mt-1 h-11"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Price/KG</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price || ""}
                            onChange={(e) => updateOrderItem(index, 'price', Number(e.target.value))}
                            data-testid={`input-price-${index}`}
                            className="mt-1 h-11"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm font-medium text-muted-foreground">Row Total</span>
                        <span className="text-lg font-bold text-primary">
                          TK {getRowTotal(item).toFixed(2)}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden lg:block border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Sale Type</TableHead>
                        <TableHead>Weight/PCS</TableHead>
                        <TableHead>Live Weight (gm)</TableHead>
                        <TableHead>Price/KG</TableHead>
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
                          
                          {/* Live Weight */}
                          <TableCell>
                            <div className="space-y-1">
                              <Input
                                type="number"
                                step="1"
                                min="1"
                                value={item.itemSaleType === "Per PCS" ? item.liveWeight : Math.round((item.liveWeight || 0) * 1000)}
                                onChange={(e) => {
                                  const inputValue = Number(e.target.value);
                                  const kgValue = item.itemSaleType === "Per PCS" ? inputValue : inputValue / 1000;
                                  updateOrderItem(index, 'liveWeight', kgValue);
                                }}
                                data-testid={`input-live-weight-${index}`}
                                className="w-20"
                                placeholder={item.itemSaleType === "Per PCS" ? "0" : "0"}
                              />
                              <div className="text-xs text-muted-foreground text-center">
                                {item.itemSaleType === "Per PCS" ? "PCS" : "gm"}
                              </div>
                            </div>
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
                          
                          {/* Row Total */}
                          <TableCell className="font-medium">
                            TK {getRowTotal(item).toFixed(2)}
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

              {/* Order-Level Discounts - Mobile-Responsive */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Order Discounts
                </h3>
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Discount Amount (TK)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={orderDiscountAmount}
                        onChange={(e) => setOrderDiscountAmount(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        data-testid="input-order-discount-amount"
                        className="mt-1 h-11 sm:h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Discount Percentage (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={orderDiscountPercentage}
                        onChange={(e) => setOrderDiscountPercentage(Number(e.target.value) || 0)}
                        placeholder="0"
                        data-testid="input-order-discount-percentage"
                        className="mt-1 h-11 sm:h-10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Summary - Mobile-Responsive */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold flex items-center">
                  <Receipt className="h-4 w-4 mr-2" />
                  Order Summary
                </h3>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center sm:text-left">
                      <Label className="text-sm font-medium text-muted-foreground">Subtotal</Label>
                      <div className="text-lg font-medium">TK {orderSummary.subtotal.toFixed(2)}</div>
                    </div>
                    <div className="text-center sm:text-left">
                      <Label className="text-sm font-medium text-muted-foreground">Discounts</Label>
                      <div className="text-lg font-medium text-red-600">-TK {orderSummary.orderDiscounts.toFixed(2)}</div>
                    </div>
                    <div className="text-center sm:text-left">
                      <Label className="text-sm font-medium text-muted-foreground">Final Total</Label>
                      <div className="text-xl font-bold text-primary">TK {orderSummary.finalTotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button - Mobile-Responsive */}
              <div className="pt-4">
                <PermissionGuard 
                  permission="create:orders"
                  fallback={
                    <div className="text-center text-muted-foreground p-4 border rounded-lg bg-muted/20">
                      You don't have permission to create orders
                    </div>
                  }
                >
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold"
                    disabled={createOrderMutation.isPending}
                    data-testid="button-submit-order"
                  >
                    Create Order
                  </Button>
                </PermissionGuard>
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
                placeholder="Search orders by number..."
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
      <PermissionGuard 
        permission="view:orders"
        fallback={
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                  <div className="text-yellow-800 dark:text-yellow-200">
                    <h3 className="font-medium mb-2">Access Restricted</h3>
                    <p>You don't have permission to view orders. Please contact your administrator if you need access.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        }
      >
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
                  <TableHead>Order Date</TableHead>
                  <TableHead>Final Total</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>
                      {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 
                       order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">TK {order.totalAmount}</TableCell>
                    <TableCell>
                      <Select 
                        value={order.paymentStatus || "Unpaid"} 
                        onValueChange={(value) => handlePaymentStatusChange(order, value)}
                      >
                        <SelectTrigger className="w-28" data-testid={`select-payment-status-${order.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unpaid">
                            <Badge variant="destructive">Unpaid</Badge>
                          </SelectItem>
                          <SelectItem value="Partial">
                            <Badge variant="secondary">Partial</Badge>
                          </SelectItem>
                          <SelectItem value="Paid">
                            <Badge variant="default">Paid</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <PermissionGuard permission="view:orders">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewOrderModal(order)}
                            data-testid={`button-view-order-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="delete:orders">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteOrderMutation.mutate(order.id)}
                            disabled={deleteOrderMutation.isPending}
                            data-testid={`button-delete-order-${order.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </PermissionGuard>

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
                      <TableHead>Live Weight</TableHead>
                      <TableHead>Price/KG</TableHead>
                      <TableHead>Discounts</TableHead>
                      <TableHead>Row Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseOrderData(viewOrderModal.items).items.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          {item.itemSaleType === "Per PCS" && !item.weightPerPCS ? 
                            (item.liveWeight || item.quantity || 0) : 
                            `${(item.liveWeight || item.quantity || 0).toFixed(0)}g`
                          } {item.itemSaleType === "Per PCS" ? "PCS" : ""}
                        </TableCell>
                        <TableCell>TK {item.price}</TableCell>
                        <TableCell>
                          {item.discountAmount > 0 && `TK ${item.discountAmount}`}
                          {item.discountAmount > 0 && item.discountPercentage > 0 && " + "}
                          {item.discountPercentage > 0 && `${item.discountPercentage}%`}
                          {!item.discountAmount && !item.discountPercentage && "None"}
                        </TableCell>
                        <TableCell>
                          TK {(() => {
                            const weight = item.liveWeight || item.quantity || 0;
                            let baseTotal = 0;
                            if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
                              // For Per PCS with weightPerPCS: Total = ((LiveWeight in grams / 1000) * WeightPerPCS) * PricePerKG
                              baseTotal = ((weight / 1000) * item.weightPerPCS) * item.price;
                            } else if (item.itemSaleType === "Per PCS") {
                              // For Per PCS without weightPerPCS: Total = LiveWeight * PricePerPCS (no division)
                              baseTotal = weight * item.price;
                            } else {
                              // For Per KG: Total = (LiveWeight in grams / 1000) * PricePerKG
                              baseTotal = (weight / 1000) * item.price;
                            }
                            
                            // Apply discounts
                            let total = baseTotal;
                            if (item.discountPercentage > 0) {
                              total = total * (1 - item.discountPercentage / 100);
                            }
                            if (item.discountAmount > 0) {
                              total = Math.max(0, total - item.discountAmount);
                            }
                            
                            return total.toFixed(2);
                          })()}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Subtotal</Label>
                        <div className="text-lg font-medium">TK {totals.subtotal.toFixed(2)}</div>
                      </div>
                      <div>
                        <Label>Order Discounts</Label>
                        <div className="text-lg font-medium text-red-600">
                          -TK {totals.orderDiscounts.toFixed(2)}
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
                        <div className="text-xl font-bold">TK {totals.finalTotal.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Entry Modal - Simplified */}
      <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Entry</DialogTitle>
            <DialogDescription>
              Record payment for Order {paymentModal?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {paymentModal && (
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-6">
                {/* Total Amount - Big and Colorful */}
                <div className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-center">
                  <div className="text-white text-sm font-medium mb-2">Total Amount</div>
                  <div className="text-white text-5xl font-bold">
                    TK {Number(paymentModal.totalAmount).toLocaleString()}
                  </div>
                </div>

                {/* Cash Payment */}
                <div className="space-y-3">
                  <FormField
                    control={paymentForm.control}
                    name="cash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-semibold">Cash Received</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter cash amount"
                            className="text-lg h-12"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                            data-testid="input-cash"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Digital Payments */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Digital Payments</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { name: "bkash", label: "bKash" },
                      { name: "rocket", label: "Rocket" },
                      { name: "nogod", label: "Nogod" },
                      { name: "card", label: "Card" },
                      { name: "bank", label: "Bank Transfer" },
                    ].map((method) => (
                      <FormField
                        key={method.name}
                        control={paymentForm.control}
                        name={method.name as keyof PaymentForm}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{method.label}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                                data-testid={`input-${method.name}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Who Received Payment */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Label className="text-sm text-muted-foreground">Payment Received By</Label>
                  <div className="text-lg font-semibold mt-1">{user?.username || "Unknown"}</div>
                </div>

                {/* Payment Summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Cash:</span>
                    <span className="font-medium">TK {calculateCashTotal(paymentForm.watch()).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm">Digital:</span>
                    <span className="font-medium">TK {calculateDigitalTotal(paymentForm.watch()).toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t flex justify-between items-center">
                    <span className="font-semibold">Total Received:</span>
                    <span className={`text-xl font-bold ${
                      Math.abs((calculateCashTotal(paymentForm.watch()) + calculateDigitalTotal(paymentForm.watch())) - Number(paymentModal.totalAmount)) < 0.01
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      TK {(calculateCashTotal(paymentForm.watch()) + calculateDigitalTotal(paymentForm.watch())).toLocaleString()}
                    </span>
                  </div>
                  {Math.abs((calculateCashTotal(paymentForm.watch()) + calculateDigitalTotal(paymentForm.watch())) - Number(paymentModal.totalAmount)) >= 0.01 && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-center">
                      <div className="text-red-800 dark:text-red-200 text-sm font-medium">
                        Difference: TK {Math.abs((calculateCashTotal(paymentForm.watch()) + calculateDigitalTotal(paymentForm.watch())) - Number(paymentModal.totalAmount)).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPaymentModal(null)}
                    data-testid="button-cancel-payment"
                  >
                    Cancel
                  </Button>
                  <PermissionGuard permission="create:orders">
                    <Button
                      type="submit"
                      className="flex-1 h-12 text-lg"
                      disabled={createPaymentMutation.isPending}
                      data-testid="button-submit-payment"
                    >
                      Accept Payment
                    </Button>
                  </PermissionGuard>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}