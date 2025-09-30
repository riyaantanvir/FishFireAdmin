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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";
import type { Order } from "@shared/schema";

export default function OrderManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewOrderModal, setViewOrderModal] = useState<Order | null>(null);
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const itemsPerPage = 20;
  
  const { toast } = useToast();
  const { canView, canDelete } = usePermissions();

  // Fetch all orders (no date filtering)
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: canView("orders"),
  });

  // Filter orders based on search term
  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  // Helper function to parse order items and discounts
  const parseOrderData = (itemsJson: string) => {
    try {
      const parsed = JSON.parse(itemsJson);
      
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
        return {
          items: parsed.items,
          orderDiscountAmount: parsed.orderDiscountAmount || 0,
          orderDiscountPercentage: parsed.orderDiscountPercentage || 0,
        };
      }
      
      if (Array.isArray(parsed)) {
        return {
          items: parsed,
          orderDiscountAmount: 0,
          orderDiscountPercentage: 0,
        };
      }
      
      return {
        items: [],
        orderDiscountAmount: 0,
        orderDiscountPercentage: 0,
      };
    } catch {
      return {
        items: [],
        orderDiscountAmount: 0,
        orderDiscountPercentage: 0,
      };
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `TK ${num.toLocaleString()}`;
  };

  // Helper function to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleViewOrder = (order: Order) => {
    setViewOrderModal(order);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Delete all orders mutation
  const deleteAllOrdersMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/orders");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setDeleteAllModal(false);
      setConfirmationText("");
      
      toast({
        title: "All orders deleted",
        description: `Successfully deleted ${data.count} orders.`,
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete orders. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Order Management</h1>
      </div>

      {/* Search Bar - Mobile Responsive */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by order number..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
              data-testid="input-search-orders"
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders Summary - Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Pending Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
              {orders.filter(o => o.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Completed Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              {orders.filter(o => o.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-primary">
              {formatCurrency(orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table - Desktop */}
      <Card className="hidden lg:block">
        <CardContent className="pt-6">
          {currentOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm ? "No orders found matching your search." : "No orders available."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentOrders.map((order) => (
                    <TableRow key={order.orderNumber}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{formatDate(order.orderDate)}</TableCell>
                      <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PermissionGuard permission="view:orders">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                            data-testid={`button-view-${order.orderNumber}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </PermissionGuard>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Orders Cards - Mobile */}
      <div className="lg:hidden space-y-4">
        {currentOrders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              {searchTerm ? "No orders found matching your search." : "No orders available."}
            </CardContent>
          </Card>
        ) : (
          <>
            {currentOrders.map((order) => (
              <Card key={order.orderNumber} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{order.orderNumber}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{order.customerName}</div>
                      </div>
                      <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                        {order.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-gray-600 dark:text-gray-300">Date</div>
                        <div className="font-medium">{formatDate(order.orderDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 dark:text-gray-300">Total</div>
                        <div className="font-bold text-primary">{formatCurrency(order.totalAmount)}</div>
                      </div>
                    </div>
                    <PermissionGuard permission="view:orders">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleViewOrder(order)}
                        data-testid={`button-view-${order.orderNumber}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </PermissionGuard>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3">
                <div className="text-sm text-center text-gray-600 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page-mobile"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page-mobile"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Order Modal - Mobile Responsive */}
      <Dialog open={!!viewOrderModal} onOpenChange={() => setViewOrderModal(null)}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Order Details</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Complete information about order {viewOrderModal?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          
          {viewOrderModal && (
            <div className="space-y-6">
              {/* Order Info - Mobile Responsive */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-sm sm:text-base">Order Information</h3>
                  <div className="space-y-2 text-sm sm:text-base">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="font-medium">Order Number:</span>
                      <span className="text-muted-foreground sm:text-foreground">{viewOrderModal.orderNumber}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="font-medium">Customer:</span>
                      <span className="text-muted-foreground sm:text-foreground">{viewOrderModal.customerName}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="font-medium">Order Date:</span>
                      <span className="text-muted-foreground sm:text-foreground">{formatDate(viewOrderModal.orderDate)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                      <span className="font-medium">Status:</span>
                      <Badge className="w-fit mt-1 sm:mt-0" variant={viewOrderModal.status === "completed" ? "default" : "secondary"}>
                        {viewOrderModal.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 text-sm sm:text-base">Order Summary</h3>
                  <div className="space-y-2 text-sm sm:text-base">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="font-medium">Total Amount:</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(viewOrderModal.totalAmount)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="font-medium">Created:</span>
                      <span className="text-muted-foreground sm:text-foreground">{viewOrderModal.createdAt ? formatDate(viewOrderModal.createdAt.toString()) : 'N/A'}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-2">Order Items</h3>
                {(() => {
                  const orderData = parseOrderData(viewOrderModal.items);
                  const { items, orderDiscountAmount, orderDiscountPercentage } = orderData;
                  
                  let subtotal = 0;
                  let totalItemDiscounts = 0;
                  
                  items.forEach((item: any) => {
                    let itemTotal = 0;
                    if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
                      itemTotal = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
                    } else if (item.itemSaleType === "Per PCS") {
                      itemTotal = item.liveWeight * item.price;
                    } else {
                      itemTotal = (item.liveWeight / 1000) * item.price;
                    }
                    
                    subtotal += itemTotal;
                    
                    let itemDiscount = 0;
                    if (item.discountPercentage > 0) {
                      itemDiscount += itemTotal * (item.discountPercentage / 100);
                    }
                    if (item.discountAmount > 0) {
                      itemDiscount += item.discountAmount;
                    }
                    totalItemDiscounts += itemDiscount;
                  });
                  
                  const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
                  
                  let orderDiscounts = 0;
                  if (orderDiscountPercentage > 0) {
                    orderDiscounts += subtotalAfterItemDiscounts * (orderDiscountPercentage / 100);
                  }
                  if (orderDiscountAmount > 0) {
                    orderDiscounts += orderDiscountAmount;
                  }
                  
                  const finalTotal = Math.max(0, subtotalAfterItemDiscounts - orderDiscounts);
                  
                  return (
                    <>
                      {/* Desktop Table - Order Items */}
                      <div className="hidden lg:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item Name</TableHead>
                              <TableHead>Live Weight</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Item Total</TableHead>
                              <TableHead>Item Discount</TableHead>
                              <TableHead>Net Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item: any, index: number) => {
                              let baseTotal = 0;
                              if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
                                baseTotal = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
                              } else if (item.itemSaleType === "Per PCS") {
                                baseTotal = item.liveWeight * item.price;
                              } else {
                                baseTotal = (item.liveWeight / 1000) * item.price;
                              }
                              
                              let itemDiscount = 0;
                              if (item.discountPercentage > 0) {
                                itemDiscount += baseTotal * (item.discountPercentage / 100);
                              }
                              if (item.discountAmount > 0) {
                                itemDiscount += item.discountAmount;
                              }
                              
                              const netTotal = Math.max(0, baseTotal - itemDiscount);
                              
                              return (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell>
                                    {item.itemSaleType === 'Per PCS' && !item.weightPerPCS ? 
                                      item.liveWeight : 
                                      `${item.liveWeight}g`
                                    }
                                  </TableCell>
                                  <TableCell>{item.itemSaleType === 'Per PCS' ? 'PCS' : 'KG'}</TableCell>
                                  <TableCell>{formatCurrency(item.price)}</TableCell>
                                  <TableCell>{formatCurrency(baseTotal)}</TableCell>
                                  <TableCell>
                                    {item.discountAmount > 0 && formatCurrency(item.discountAmount)}
                                    {item.discountPercentage > 0 && (item.discountAmount > 0 ? ` + ${item.discountPercentage}%` : `${item.discountPercentage}%`)}
                                    {item.discountAmount === 0 && item.discountPercentage === 0 && '-'}
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    {formatCurrency(netTotal)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Card View - Order Items */}
                      <div className="lg:hidden space-y-3">
                        {items.map((item: any, index: number) => {
                          let baseTotal = 0;
                          if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
                            baseTotal = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
                          } else if (item.itemSaleType === "Per PCS") {
                            baseTotal = item.liveWeight * item.price;
                          } else {
                            baseTotal = (item.liveWeight / 1000) * item.price;
                          }
                          
                          let itemDiscount = 0;
                          if (item.discountPercentage > 0) {
                            itemDiscount += baseTotal * (item.discountPercentage / 100);
                          }
                          if (item.discountAmount > 0) {
                            itemDiscount += item.discountAmount;
                          }
                          
                          const netTotal = Math.max(0, baseTotal - itemDiscount);
                          
                          return (
                            <Card key={index} className="p-4">
                              <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-semibold text-sm">{item.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {item.itemSaleType === 'Per PCS' ? 'PCS' : 'KG'}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Weight:</span>
                                    <span>
                                      {item.itemSaleType === 'Per PCS' && !item.weightPerPCS ? 
                                        item.liveWeight : 
                                        `${item.liveWeight}g`
                                      }
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price:</span>
                                    <span>{formatCurrency(item.price)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total:</span>
                                    <span>{formatCurrency(baseTotal)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Discount:</span>
                                    <span className="text-red-600">
                                      {item.discountAmount > 0 && formatCurrency(item.discountAmount)}
                                      {item.discountPercentage > 0 && (item.discountAmount > 0 ? ` + ${item.discountPercentage}%` : `${item.discountPercentage}%`)}
                                      {item.discountAmount === 0 && item.discountPercentage === 0 && '-'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                  <span className="text-sm font-medium">Net Total:</span>
                                  <span className="text-sm font-bold text-primary">{formatCurrency(netTotal)}</span>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                      
                      {/* Order Summary */}
                      <div className="mt-4 border-t pt-4">
                        <div className="space-y-2 max-w-md ml-auto">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          {totalItemDiscounts > 0 && (
                            <div className="flex justify-between text-red-600">
                              <span>Item Discounts:</span>
                              <span>-{formatCurrency(totalItemDiscounts)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Subtotal after Item Discounts:</span>
                            <span>{formatCurrency(subtotalAfterItemDiscounts)}</span>
                          </div>
                          {orderDiscounts > 0 && (
                            <>
                              <div className="flex justify-between text-blue-600">
                                <span>Order-level Discounts:</span>
                                <span>-{formatCurrency(orderDiscounts)}</span>
                              </div>
                              {orderDiscountPercentage > 0 && (
                                <div className="text-xs text-blue-600 ml-4">
                                  {orderDiscountPercentage}% order discount
                                </div>
                              )}
                              {orderDiscountAmount > 0 && (
                                <div className="text-xs text-blue-600 ml-4">
                                  {formatCurrency(orderDiscountAmount)} fixed discount
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>Final Total:</span>
                            <span>{formatCurrency(finalTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Danger Zone */}
      {orders.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete All Orders</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Permanently delete all order records. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteAllModal(true)}
                data-testid="button-delete-all-orders"
              >
                Delete All Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete All Confirmation Modal */}
      <Dialog open={deleteAllModal} onOpenChange={() => {
        setDeleteAllModal(false);
        setConfirmationText("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete All Orders</DialogTitle>
            <DialogDescription>
              This action will permanently delete all {orders.length} order records and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> This will permanently delete all order data including customer information, items, and transaction history.
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium">
                Type <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">DELETE ALL ORDERS</code> to confirm:
              </label>
              <Input
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="DELETE ALL ORDERS"
                className="mt-2"
                data-testid="input-delete-confirmation"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAllModal(false);
                setConfirmationText("");
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAllOrdersMutation.mutate()}
              disabled={confirmationText !== "DELETE ALL ORDERS" || deleteAllOrdersMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteAllOrdersMutation.isPending ? "Deleting..." : "Delete All Orders"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
