import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { Order } from "@shared/schema";

export default function OrderManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewOrderModal, setViewOrderModal] = useState<Order | null>(null);
  const itemsPerPage = 20;

  // Fetch all orders (no date filtering)
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Filter orders based on search term
  const filteredOrders = orders.filter(order =>
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      
      // Handle new wrapped format: { items, orderDiscountAmount, orderDiscountPercentage }
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
        return {
          items: parsed.items,
          orderDiscountAmount: parsed.orderDiscountAmount || 0,
          orderDiscountPercentage: parsed.orderDiscountPercentage || 0,
        };
      }
      
      // Handle legacy format: direct array
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
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

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Order Management</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Total Orders: {orders.length}
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                data-testid="input-search-orders"
                placeholder="Search by customer name or order number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Orders History</CardTitle>
        </CardHeader>
        <CardContent>
          {currentOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm ? "No orders found matching your search." : "No orders found."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Final Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium" data-testid={`text-order-number-${order.id}`}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell data-testid={`text-customer-name-${order.id}`}>
                          {order.customerName}
                        </TableCell>
                        <TableCell data-testid={`text-order-date-${order.id}`}>
                          {formatDate(order.orderDate)}
                        </TableCell>
                        <TableCell data-testid={`text-final-total-${order.id}`}>
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={order.status === "completed" ? "default" : "secondary"}
                            data-testid={`badge-status-${order.id}`}
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                            data-testid={`button-view-order-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of{" "}
                    {filteredOrders.length} orders
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-previous-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm" data-testid="text-page-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <Dialog open={!!viewOrderModal} onOpenChange={() => setViewOrderModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete information for {viewOrderModal?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          
          {viewOrderModal && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Order Information</h3>
                  <div className="space-y-2">
                    <p><strong>Order Number:</strong> {viewOrderModal.orderNumber}</p>
                    <p><strong>Customer:</strong> {viewOrderModal.customerName}</p>
                    <p><strong>Order Date:</strong> {formatDate(viewOrderModal.orderDate)}</p>
                    <p><strong>Status:</strong> 
                      <Badge className="ml-2" variant={viewOrderModal.status === "completed" ? "default" : "secondary"}>
                        {viewOrderModal.status}
                      </Badge>
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Order Summary</h3>
                  <div className="space-y-2">
                    <p><strong>Total Amount:</strong> {formatCurrency(viewOrderModal.totalAmount)}</p>
                    <p><strong>Created:</strong> {viewOrderModal.createdAt ? formatDate(viewOrderModal.createdAt.toString()) : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-2">Order Items</h3>
                {(() => {
                  const orderData = parseOrderData(viewOrderModal.items);
                  const { items, orderDiscountAmount, orderDiscountPercentage } = orderData;
                  
                  // Calculate totals
                  let subtotal = 0;
                  let totalItemDiscounts = 0;
                  
                  items.forEach((item: any) => {
                    // Calculate item base total
                    let itemTotal = 0;
                    if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
                      itemTotal = (item.liveWeight * item.weightPerPCS) * item.price;
                    } else {
                      itemTotal = item.liveWeight * item.price;
                    }
                    
                    subtotal += itemTotal;
                    
                    // Calculate item discount
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
                      <div className="overflow-x-auto">
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
                              // Calculate item totals
                              let baseTotal = 0;
                              if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
                                baseTotal = (item.liveWeight * item.weightPerPCS) * item.price;
                              } else {
                                baseTotal = item.liveWeight * item.price;
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
                                  <TableCell>{item.liveWeight}</TableCell>
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
    </div>
  );
}