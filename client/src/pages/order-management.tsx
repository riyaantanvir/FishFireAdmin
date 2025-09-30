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
import { Search, Eye, ChevronLeft, ChevronRight, Download, Upload, FileText, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@shared/schema";

interface ImportRow {
  orderNumber: string;
  date: string;
  customer: string;
  itemName: string;
  liveWeight: string;
  kgPcgPrice: string;
  pcs: string;
  discountPercent: string;
  discountTk: string;
  paidBill: string;
  paymentMethod: string;
  comment: string;
  errors: string[];
  rowIndex: number;
}

export default function OrderManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewOrderModal, setViewOrderModal] = useState<Order | null>(null);
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  
  // Edit/Delete states
  const [editOrderModal, setEditOrderModal] = useState<Order | null>(null);
  const [deleteOrderModal, setDeleteOrderModal] = useState<Order | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  // Import/Export states
  const [importPreviewModal, setImportPreviewModal] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const itemsPerPage = 20;
  
  const { toast } = useToast();
  const { canView, canDelete, canCreate, canExport } = usePermissions();

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

  const handleEditOrder = (order: Order) => {
    setEditOrderModal(order);
  };

  const handleDeleteOrder = (order: Order) => {
    setDeleteOrderModal(order);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Download CSV Template
  const handleDownloadTemplate = () => {
    const headers = [
      "Order Number",
      "Date",
      "Customer",
      "Item Name",
      "Live Weight",
      "KG/PCG Price",
      "PCS",
      "Discount %",
      "Discount TK",
      "PAID BILL",
      "Payment Method",
      "Comment"
    ];
    
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-template-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded successfully.",
    });
  };

  // Parse and validate CSV
  const parseCSV = (csvText: string): ImportRow[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows: ImportRow[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const errors: string[] = [];
      
      const orderNumber = values[0] || '';
      const date = values[1] || '';
      const customer = values[2] || '';
      const itemName = values[3] || '';
      const liveWeight = values[4] || '';
      const kgPcgPrice = values[5] || '';
      const pcs = values[6] || '';
      const discountPercent = values[7] || '';
      const discountTk = values[8] || '';
      const paidBill = values[9] || '';
      const paymentMethod = values[10] || '';
      const comment = values[11] || '';
      
      // Validation
      if (!orderNumber) errors.push('Order Number is required');
      if (!date) errors.push('Date is required');
      if (!itemName) errors.push('Item Name is required');
      if (!kgPcgPrice || isNaN(Number(kgPcgPrice))) errors.push('KG/PCG Price must be a valid number');
      if (!liveWeight && !pcs) errors.push('Either Live Weight or PCS must be filled');
      if (liveWeight && isNaN(Number(liveWeight))) errors.push('Live Weight must be a valid number');
      if (pcs && isNaN(Number(pcs))) errors.push('PCS must be a valid number');
      if (discountPercent && isNaN(Number(discountPercent))) errors.push('Discount % must be a valid number');
      if (discountTk && isNaN(Number(discountTk))) errors.push('Discount TK must be a valid number');
      
      rows.push({
        orderNumber,
        date,
        customer,
        itemName,
        liveWeight,
        kgPcgPrice,
        pcs,
        discountPercent,
        discountTk,
        paidBill,
        paymentMethod,
        comment,
        errors,
        rowIndex: i
      });
    }
    
    return rows;
  };

  // Calculate bill for a row
  const calculateBill = (row: ImportRow): number => {
    const price = Number(row.kgPcgPrice) || 0;
    let total = 0;
    
    if (row.liveWeight) {
      // Convert grams to kg and calculate
      const weightInKg = Number(row.liveWeight) / 1000;
      total = weightInKg * price;
    } else if (row.pcs) {
      // PCS calculation
      total = Number(row.pcs) * price;
    }
    
    // Apply discounts
    const discountTk = Number(row.discountTk) || 0;
    const discountPercent = Number(row.discountPercent) || 0;
    
    total = total - discountTk - (total * (discountPercent / 100));
    
    return Math.max(0, total);
  };

  // Handle CSV file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      const parsed = parseCSV(csvText);
      setImportData(parsed);
      setImportPreviewModal(true);
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  // Update import row
  const updateImportRow = (rowIndex: number, field: keyof ImportRow, value: string) => {
    setImportData(prev => prev.map(row => {
      if (row.rowIndex === rowIndex) {
        const updated = { ...row, [field]: value };
        
        // Re-validate
        const errors: string[] = [];
        if (!updated.orderNumber) errors.push('Order Number is required');
        if (!updated.date) errors.push('Date is required');
        if (!updated.itemName) errors.push('Item Name is required');
        if (!updated.kgPcgPrice || isNaN(Number(updated.kgPcgPrice))) errors.push('KG/PCG Price must be a valid number');
        if (!updated.liveWeight && !updated.pcs) errors.push('Either Live Weight or PCS must be filled');
        if (updated.liveWeight && isNaN(Number(updated.liveWeight))) errors.push('Live Weight must be a valid number');
        if (updated.pcs && isNaN(Number(updated.pcs))) errors.push('PCS must be a valid number');
        if (updated.discountPercent && isNaN(Number(updated.discountPercent))) errors.push('Discount % must be a valid number');
        if (updated.discountTk && isNaN(Number(updated.discountTk))) errors.push('Discount TK must be a valid number');
        
        updated.errors = errors;
        return updated;
      }
      return row;
    }));
  };

  // Submit import
  const handleSubmitImport = async () => {
    // Check for errors
    const hasErrors = importData.some(row => row.errors.length > 0);
    if (hasErrors) {
      toast({
        title: "Validation Errors",
        description: "Please fix all errors before submitting.",
        variant: "destructive",
      });
      return;
    }
    
    setIsImporting(true);
    setImportProgress(0);
    
    // Group by order number
    const orderGroups = importData.reduce((acc, row) => {
      if (!acc[row.orderNumber]) {
        acc[row.orderNumber] = [];
      }
      acc[row.orderNumber].push(row);
      return acc;
    }, {} as Record<string, ImportRow[]>);
    
    const orderNumbers = Object.keys(orderGroups);
    const totalOrders = orderNumbers.length;
    
    try {
      for (let i = 0; i < totalOrders; i++) {
        const orderNumber = orderNumbers[i];
        const orderRows = orderGroups[orderNumber];
        const firstRow = orderRows[0];
        
        // Calculate total for this order
        let orderTotal = 0;
        const items = orderRows.map(row => {
          const itemTotal = calculateBill(row);
          orderTotal += itemTotal;
          
          return {
            name: row.itemName,
            liveWeight: row.liveWeight ? Number(row.liveWeight) : (row.pcs ? Number(row.pcs) : 0),
            price: Number(row.kgPcgPrice),
            itemSaleType: row.liveWeight ? "Per KG" : "Per PCS",
            discountPercentage: Number(row.discountPercent) || 0,
            discountAmount: Number(row.discountTk) || 0,
          };
        });
        
        // Create order (Note: paymentMethod and comment from CSV are not stored in current schema)
        await apiRequest("POST", "/api/orders", {
          orderNumber: orderNumber,
          customerName: firstRow.customer || 'Walk-in Customer',
          orderDate: firstRow.date,
          totalAmount: orderTotal.toString(),
          status: 'completed',
          items: JSON.stringify({ items }),
        });
        
        setImportProgress(Math.round(((i + 1) / totalOrders) * 100));
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      
      toast({
        title: "Import Successful",
        description: `Successfully imported ${totalOrders} orders.`,
      });
      
      setImportPreviewModal(false);
      setImportData([]);
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "An error occurred during import. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Export all orders
  const handleExportOrders = () => {
    if (orders.length === 0) {
      toast({
        title: "No Data",
        description: "No orders available to export.",
        variant: "destructive",
      });
      return;
    }
    
    const headers = [
      "Order Number",
      "Date",
      "Customer",
      "Item Name",
      "Live Weight",
      "KG/PCG Price",
      "PCS",
      "Discount %",
      "Discount TK",
      "PAID BILL",
      "Payment Method",
      "Comment"
    ];
    
    const rows: string[] = [headers.join(",")];
    
    orders.forEach(order => {
      const orderData = parseOrderData(order.items);
      const orderDate = new Date(order.orderDate).toISOString().split('T')[0];
      
      orderData.items.forEach((item: any) => {
        const liveWeight = item.itemSaleType === 'Per KG' ? item.liveWeight : '';
        const pcs = item.itemSaleType === 'Per PCS' ? item.liveWeight : '';
        
        // Calculate bill using same logic as import: (liveWeight / 1000) * price for KG, pcs * price for PCS
        let itemTotal = 0;
        if (item.itemSaleType === 'Per KG' && liveWeight) {
          itemTotal = (Number(liveWeight) / 1000) * Number(item.price);
        } else if (item.itemSaleType === 'Per PCS' && pcs) {
          itemTotal = Number(pcs) * Number(item.price);
        }
        
        // Apply discounts
        const discountTk = Number(item.discountAmount) || 0;
        const discountPercent = Number(item.discountPercentage) || 0;
        const calculatedBill = Math.max(0, itemTotal - discountTk - (itemTotal * (discountPercent / 100)));
        
        const row = [
          order.orderNumber,
          orderDate,
          order.customerName || '',
          item.name,
          liveWeight,
          item.price,
          pcs,
          item.discountPercentage || '',
          item.discountAmount || '',
          calculatedBill.toFixed(2),
          '', // Payment Method - not stored in current Order schema
          '' // Comment - not stored in current Order schema
        ].map(v => `"${v}"`).join(",");
        
        rows.push(row);
      });
    });
    
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: `Exported ${orders.length} orders to CSV.`,
    });
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

  // Edit order mutation
  const editOrderMutation = useMutation({
    mutationFn: async (data: { orderNumber: string; updates: Partial<Order> }) => {
      return apiRequest("PUT", `/api/orders/${data.orderNumber}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setEditOrderModal(null);
      toast({
        title: "Order updated",
        description: "Order has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete single order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderNumber: string) => {
      return apiRequest("DELETE", `/api/orders/${orderNumber}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setDeleteOrderModal(null);
      setDeleteConfirmText("");
      toast({
        title: "Order deleted",
        description: "Order has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete order. Please try again.",
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            data-testid="button-download-template"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <PermissionGuard permission="create:orders">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('csv-upload')?.click()}
              data-testid="button-import-csv"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </PermissionGuard>
          <PermissionGuard permission="export:orders">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportOrders}
              disabled={orders.length === 0}
              data-testid="button-export-data"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </PermissionGuard>
        </div>
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
                        <div className="flex items-center gap-2">
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
                          <PermissionGuard permission="edit:orders">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOrder(order)}
                              data-testid={`button-edit-${order.orderNumber}`}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="delete:orders">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => handleDeleteOrder(order)}
                              data-testid={`button-delete-${order.orderNumber}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </PermissionGuard>
                        </div>
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
                    <div className="flex gap-2">
                      <PermissionGuard permission="view:orders">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleViewOrder(order)}
                          data-testid={`button-view-${order.orderNumber}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission="edit:orders">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEditOrder(order)}
                          data-testid={`button-edit-${order.orderNumber}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission="delete:orders">
                        <Button
                          variant="outline"
                          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDeleteOrder(order)}
                          data-testid={`button-delete-${order.orderNumber}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </PermissionGuard>
                    </div>
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

      {/* Import Preview Modal */}
      <Dialog open={importPreviewModal} onOpenChange={() => {
        if (!isImporting) {
          setImportPreviewModal(false);
          setImportData([]);
        }
      }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">CSV Import Preview</DialogTitle>
            <DialogDescription>
              Review and edit data before importing. Rows with errors are highlighted in red.
            </DialogDescription>
          </DialogHeader>

          {isImporting && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Importing orders...</span>
                <span className="text-sm text-muted-foreground">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {!isImporting && (
            <>
              {/* Error Summary */}
              {importData.some(row => row.errors.length > 0) && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        {importData.filter(row => row.errors.length > 0).length} rows have errors
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                        Please fix all errors before submitting.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Preview Table - Desktop */}
              <div className="hidden lg:block overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[80px]">Row</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Weight(g)</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>PCS</TableHead>
                      <TableHead>Disc%</TableHead>
                      <TableHead>Disc TK</TableHead>
                      <TableHead>Calculated Bill</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((row) => (
                      <TableRow key={row.rowIndex} className={row.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <TableCell className="font-mono text-xs">{row.rowIndex}</TableCell>
                        <TableCell>
                          <Input
                            value={row.orderNumber}
                            onChange={(e) => updateImportRow(row.rowIndex, 'orderNumber', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Order Number')) ? 'border-red-500' : ''}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.date}
                            onChange={(e) => updateImportRow(row.rowIndex, 'date', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Date')) ? 'border-red-500' : ''}`}
                            type="date"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.customer}
                            onChange={(e) => updateImportRow(row.rowIndex, 'customer', e.target.value)}
                            className="h-8"
                            placeholder="Optional"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.itemName}
                            onChange={(e) => updateImportRow(row.rowIndex, 'itemName', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Item Name')) ? 'border-red-500' : ''}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.liveWeight}
                            onChange={(e) => updateImportRow(row.rowIndex, 'liveWeight', e.target.value)}
                            className={`h-8 w-24 ${row.errors.some(e => e.includes('Live Weight')) ? 'border-red-500' : ''}`}
                            type="number"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.kgPcgPrice}
                            onChange={(e) => updateImportRow(row.rowIndex, 'kgPcgPrice', e.target.value)}
                            className={`h-8 w-24 ${row.errors.some(e => e.includes('Price')) ? 'border-red-500' : ''}`}
                            type="number"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.pcs}
                            onChange={(e) => updateImportRow(row.rowIndex, 'pcs', e.target.value)}
                            className={`h-8 w-20 ${row.errors.some(e => e.includes('PCS')) ? 'border-red-500' : ''}`}
                            type="number"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.discountPercent}
                            onChange={(e) => updateImportRow(row.rowIndex, 'discountPercent', e.target.value)}
                            className="h-8 w-20"
                            type="number"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.discountTk}
                            onChange={(e) => updateImportRow(row.rowIndex, 'discountTk', e.target.value)}
                            className="h-8 w-24"
                            type="number"
                          />
                        </TableCell>
                        <TableCell className="font-semibold">
                          TK {calculateBill(row).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <div className="text-xs text-red-600 space-y-1">
                              {row.errors.map((error, i) => (
                                <div key={i}>• {error}</div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Data Preview Cards - Mobile */}
              <div className="lg:hidden space-y-3 max-h-[500px] overflow-y-auto">
                {importData.map((row) => (
                  <Card key={row.rowIndex} className={row.errors.length > 0 ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-muted-foreground">Row {row.rowIndex}</span>
                        {row.errors.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {row.errors.length} errors
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Order #</label>
                          <Input
                            value={row.orderNumber}
                            onChange={(e) => updateImportRow(row.rowIndex, 'orderNumber', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Order Number')) ? 'border-red-500' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Date</label>
                          <Input
                            value={row.date}
                            onChange={(e) => updateImportRow(row.rowIndex, 'date', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Date')) ? 'border-red-500' : ''}`}
                            type="date"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground">Customer (Optional)</label>
                          <Input
                            value={row.customer}
                            onChange={(e) => updateImportRow(row.rowIndex, 'customer', e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground">Item Name</label>
                          <Input
                            value={row.itemName}
                            onChange={(e) => updateImportRow(row.rowIndex, 'itemName', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Item Name')) ? 'border-red-500' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Weight (g)</label>
                          <Input
                            value={row.liveWeight}
                            onChange={(e) => updateImportRow(row.rowIndex, 'liveWeight', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Live Weight')) ? 'border-red-500' : ''}`}
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">PCS</label>
                          <Input
                            value={row.pcs}
                            onChange={(e) => updateImportRow(row.rowIndex, 'pcs', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('PCS')) ? 'border-red-500' : ''}`}
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Price</label>
                          <Input
                            value={row.kgPcgPrice}
                            onChange={(e) => updateImportRow(row.rowIndex, 'kgPcgPrice', e.target.value)}
                            className={`h-8 ${row.errors.some(e => e.includes('Price')) ? 'border-red-500' : ''}`}
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Discount %</label>
                          <Input
                            value={row.discountPercent}
                            onChange={(e) => updateImportRow(row.rowIndex, 'discountPercent', e.target.value)}
                            className="h-8"
                            type="number"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Discount TK</label>
                          <Input
                            value={row.discountTk}
                            onChange={(e) => updateImportRow(row.rowIndex, 'discountTk', e.target.value)}
                            className="h-8"
                            type="number"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm font-medium">Calculated Bill:</span>
                        <span className="text-lg font-bold text-primary">TK {calculateBill(row).toFixed(2)}</span>
                      </div>

                      {row.errors.length > 0 && (
                        <div className="text-xs text-red-600 space-y-1 p-2 bg-red-100 dark:bg-red-900/20 rounded">
                          {row.errors.map((error, i) => (
                            <div key={i}>• {error}</div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Summary:</strong> {importData.length} rows will be imported as {Object.keys(importData.reduce((acc, row) => {
                    if (!acc[row.orderNumber]) acc[row.orderNumber] = true;
                    return acc;
                  }, {} as Record<string, boolean>)).length} orders
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportPreviewModal(false);
                    setImportData([]);
                  }}
                  data-testid="button-cancel-import"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitImport}
                  disabled={importData.some(row => row.errors.length > 0)}
                  data-testid="button-submit-import"
                >
                  Submit Import
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Modal */}
      <Dialog open={!!editOrderModal} onOpenChange={() => setEditOrderModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>
              Update order details for {editOrderModal?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          {editOrderModal && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Customer Name</label>
                <Input
                  value={editOrderModal.customerName || ''}
                  onChange={(e) => setEditOrderModal({ ...editOrderModal, customerName: e.target.value })}
                  data-testid="input-edit-customer"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Order Date</label>
                <Input
                  type="date"
                  value={new Date(editOrderModal.orderDate).toISOString().split('T')[0]}
                  onChange={(e) => setEditOrderModal({ ...editOrderModal, orderDate: e.target.value })}
                  data-testid="input-edit-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Total Amount (TK)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editOrderModal.totalAmount}
                  onChange={(e) => setEditOrderModal({ ...editOrderModal, totalAmount: e.target.value })}
                  data-testid="input-edit-total"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded p-2"
                  value={editOrderModal.status}
                  onChange={(e) => setEditOrderModal({ ...editOrderModal, status: e.target.value as 'pending' | 'completed' })}
                  data-testid="select-edit-status"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditOrderModal(null)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    editOrderMutation.mutate({
                      orderNumber: editOrderModal.orderNumber,
                      updates: {
                        customerName: editOrderModal.customerName,
                        orderDate: editOrderModal.orderDate,
                        totalAmount: editOrderModal.totalAmount,
                        status: editOrderModal.status,
                      },
                    });
                  }}
                  disabled={editOrderMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {editOrderMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Order Confirmation Modal */}
      <Dialog open={!!deleteOrderModal} onOpenChange={() => {
        setDeleteOrderModal(null);
        setDeleteConfirmText("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Order</DialogTitle>
            <DialogDescription>
              This action will permanently delete order {deleteOrderModal?.orderNumber} and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> This will permanently delete this order including all its items and transaction details.
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium">
                Type <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">DELETE</code> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-2"
                data-testid="input-delete-single-confirmation"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOrderModal(null);
                setDeleteConfirmText("");
              }}
              data-testid="button-cancel-delete-single"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteOrderModal) {
                  deleteOrderMutation.mutate(deleteOrderModal.orderNumber);
                }
              }}
              disabled={deleteConfirmText !== "DELETE" || deleteOrderMutation.isPending}
              data-testid="button-confirm-delete-single"
            >
              {deleteOrderMutation.isPending ? "Deleting..." : "Delete Order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
