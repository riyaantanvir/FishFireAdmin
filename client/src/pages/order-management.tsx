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
import { Search, Eye, ChevronLeft, ChevronRight, Download, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order } from "@shared/schema";

export default function OrderManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewOrderModal, setViewOrderModal] = useState<Order | null>(null);
  const [importPreviewModal, setImportPreviewModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [mergedOrders, setMergedOrders] = useState<any[]>([]);
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const itemsPerPage = 20;
  
  const { toast } = useToast();

  // Fetch all orders (no date filtering)
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
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

  // CSV field escaping for proper generation
  const escapeCSVField = (field: string): string => {
    const stringField = String(field || '');
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    
    return stringField;
  };

  // Export orders to CSV with expanded rows for each item
  const exportOrdersToCSV = () => {
    const headers = [
      'Order Number',
      'Order Date',
      'Item Name',
      'Live Weight',
      'Unit Type',
      'Unit Price',
      'Item Total',
      'Discount Amount',
      'Discount %',
      'Final Row Total'
    ];

    const csvRows = [headers.map(escapeCSVField).join(',')];

    orders.forEach(order => {
      const orderData = parseOrderData(order.items);
      const { items, orderDiscountAmount, orderDiscountPercentage } = orderData;
      
      // Calculate order-level totals for proportional distribution
      let orderSubtotal = 0;
      let totalItemDiscounts = 0;
      
      items.forEach((item: any) => {
        let itemTotal = 0;
        if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
          itemTotal = (item.liveWeight * item.weightPerPCS) * item.price;
        } else {
          itemTotal = item.liveWeight * item.price;
        }
        orderSubtotal += itemTotal;
        
        let itemDiscount = 0;
        if (item.discountPercentage > 0) {
          itemDiscount += itemTotal * (item.discountPercentage / 100);
        }
        if (item.discountAmount > 0) {
          itemDiscount += item.discountAmount;
        }
        totalItemDiscounts += itemDiscount;
      });

      const subtotalAfterItemDiscounts = orderSubtotal - totalItemDiscounts;
      let totalOrderDiscounts = 0;
      if (orderDiscountPercentage > 0) {
        totalOrderDiscounts += subtotalAfterItemDiscounts * (orderDiscountPercentage / 100);
      }
      if (orderDiscountAmount > 0) {
        totalOrderDiscounts += orderDiscountAmount;
      }

      items.forEach((item: any) => {
        // Calculate item base total
        let baseTotal = 0;
        if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
          baseTotal = (item.liveWeight * item.weightPerPCS) * item.price;
        } else {
          baseTotal = item.liveWeight * item.price;
        }
        
        // Calculate item-level discounts
        let itemDiscount = 0;
        let itemDiscountPercentage = 0;
        if (item.discountPercentage > 0) {
          itemDiscount += baseTotal * (item.discountPercentage / 100);
          itemDiscountPercentage = item.discountPercentage;
        }
        if (item.discountAmount > 0) {
          itemDiscount += item.discountAmount;
        }
        
        const netItemTotal = Math.max(0, baseTotal - itemDiscount);
        
        // Calculate proportional order-level discount for this item
        let itemOrderDiscount = 0;
        if (subtotalAfterItemDiscounts > 0 && totalOrderDiscounts > 0) {
          itemOrderDiscount = (netItemTotal / subtotalAfterItemDiscounts) * totalOrderDiscounts;
        }
        
        const finalRowTotal = Math.max(0, netItemTotal - itemOrderDiscount);
        
        const row = [
          order.orderNumber,
          order.orderDate,
          item.name || '',
          item.liveWeight || 0,
          item.itemSaleType === 'Per PCS' ? 'PCS' : 'KG',
          item.price || 0,
          baseTotal.toFixed(2),
          (itemDiscount + itemOrderDiscount).toFixed(2),
          itemDiscountPercentage || 0,
          finalRowTotal.toFixed(2)
        ];
        
        csvRows.push(row.map(escapeCSVField).join(','));
      });
    });

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Template CSV download
  const downloadTemplate = () => {
    const headers = [
      'Order Number',
      'Order Date',
      'Item Name',
      'Live Weight',
      'Unit Type',
      'Unit Price',
      'Item Total',
      'Discount Amount',
      'Discount %',
      'Final Row Total'
    ];

    const sampleData = [
      'ORD-001,2025-09-28,Salmon Fish,2500,KG,15.00,37.50,2.00,5,33.63',
      'ORD-001,2025-09-28,Chicken Breast,3000,PCS,8.00,24.00,0,0,21.60',
      'ORD-002,2025-09-28,Tuna Fish,1800,KG,20.00,36.00,0,10,32.40'
    ];

    const csvRows = [headers.map(escapeCSVField).join(','), ...sampleData];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'orders-import-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV parsing helper function 
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote inside quoted field
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator found outside quotes
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field
    result.push(current);
    
    return result;
  };

  // Handle file import
  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        toast({
          title: "Empty file",
          description: "The uploaded file appears to be empty.",
          variant: "destructive",
        });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const expectedHeaders = ['Order Number', 'Order Date', 'Item Name', 'Live Weight', 'Unit Type', 'Unit Price', 'Item Total', 'Discount Amount', 'Discount %', 'Final Row Total'];
      
      // Check if headers match expected format (only these are required)
      const requiredHeaders = ['Order Number', 'Order Date', 'Item Name'];
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      
      if (missingHeaders.length > 0) {
        toast({
          title: "Invalid CSV format",
          description: `Missing required headers: ${missingHeaders.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      const importedData = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i]);
          const rowData: any = {};
          
          headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
          });

          // Validate required fields
          let hasError = false;
          
          if (!rowData['Order Number'] || !rowData['Order Number'].trim()) {
            errors.push(`Row ${i + 1}: Missing Order Number`);
            hasError = true;
          }
          
          if (!rowData['Order Date'] || !rowData['Order Date'].trim()) {
            errors.push(`Row ${i + 1}: Missing Order Date`);
            hasError = true;
          } else {
            // Validate date format (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(rowData['Order Date'])) {
              errors.push(`Row ${i + 1}: Invalid date format (expected YYYY-MM-DD)`);
              hasError = true;
            }
          }
          
          if (!rowData['Item Name'] || !rowData['Item Name'].trim()) {
            errors.push(`Row ${i + 1}: Missing Item Name`);
            hasError = true;
          }
          
          // Validate numeric fields (optional - can be blank)
          const liveWeight = rowData['Live Weight'] ? parseFloat(rowData['Live Weight']) : 1;
          const unitPrice = rowData['Unit Price'] ? parseFloat(rowData['Unit Price']) : 0;
          
          // Only validate if values are provided
          if (rowData['Live Weight'] && (isNaN(liveWeight) || liveWeight <= 0)) {
            errors.push(`Row ${i + 1}: Invalid Live Weight (must be a positive number if provided)`);
            hasError = true;
          }
          
          if (rowData['Unit Price'] && (isNaN(unitPrice) || unitPrice < 0)) {
            errors.push(`Row ${i + 1}: Invalid Unit Price (must be a non-negative number if provided)`);
            hasError = true;
          }

          if (!hasError) {
            importedData.push({
              rowNumber: i + 1,
              ...rowData,
              'Live Weight': liveWeight,
              'Unit Price': unitPrice,
              'Discount Amount': parseFloat(rowData['Discount Amount'] || '0'),
              'Discount %': parseFloat(rowData['Discount %'] || '0'),
            });
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: Failed to parse row data`);
        }
      }

      // Group by order number to create merged orders
      const orderGroups: { [key: string]: any } = {};
      
      importedData.forEach(row => {
        const orderNumber = row['Order Number'];
        if (!orderGroups[orderNumber]) {
          orderGroups[orderNumber] = {
            orderNumber,
            orderDate: row['Order Date'],
            items: [],
          };
        }
        
        orderGroups[orderNumber].items.push({
          name: row['Item Name'],
          liveWeight: row['Live Weight'] || 1,
          itemSaleType: row['Unit Type'] === 'PCS' ? 'Per PCS' : 'Per KG',
          price: row['Unit Price'] || 0,
          discountAmount: row['Discount Amount'] || 0,
          discountPercentage: row['Discount %'] || 0,
        });
      });

      const mergedOrderList = Object.values(orderGroups);

      setImportData(importedData);
      setImportErrors(errors);
      setMergedOrders(mergedOrderList);
      setImportPreviewModal(true);

    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to read or parse the uploaded file.",
        variant: "destructive",
      });
    }
  };

  // Submit import data with batch processing
  const submitImportMutation = useMutation({
    mutationFn: async () => {
      const BATCH_SIZE = 50; // Process 50 orders at a time
      const batches = [];
      
      // Split orders into batches
      for (let i = 0; i < mergedOrders.length; i += BATCH_SIZE) {
        batches.push(mergedOrders.slice(i, i + BATCH_SIZE));
      }
      
      setImportProgress({ current: 0, total: mergedOrders.length });
      
      const results = [];
      let processedCount = 0;
      
      // Process each batch sequentially to avoid overwhelming the server
      for (const batch of batches) {
        const batchPromises = batch.map(order => {
          // Calculate totals for the order
          let subtotal = 0;
          let itemDiscounts = 0;
          
          order.items.forEach((item: any) => {
            let itemTotal = 0;
            if (item.itemSaleType === "Per PCS" && item.weightPerPCS) {
              // For Per PCS: Total = ((LiveWeight in grams / 1000) * WeightPerPCS) * PricePerKG
              itemTotal = ((item.liveWeight / 1000) * item.weightPerPCS) * item.price;
            } else {
              // For Per KG: Total = (LiveWeight in grams / 1000) * PricePerKG
              itemTotal = (item.liveWeight / 1000) * item.price;
            }
            subtotal += itemTotal;
            
            let discount = 0;
            if (item.discountPercentage > 0) {
              discount += itemTotal * (item.discountPercentage / 100);
            }
            if (item.discountAmount > 0) {
              discount += item.discountAmount;
            }
            itemDiscounts += discount;
          });

          const finalTotal = Math.max(0, subtotal - itemDiscounts);

          const orderData = {
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            items: JSON.stringify({
              items: order.items,
              orderDiscountAmount: 0,
              orderDiscountPercentage: 0,
            }),
            totalAmount: finalTotal.toString(),
            status: "pending",
          };

          return apiRequest("POST", "/api/orders", orderData);
        });

        // Wait for current batch to complete before proceeding
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
        
        processedCount += batch.length;
        setImportProgress({ current: processedCount, total: mergedOrders.length });
        
        // Small delay between batches to prevent server overload
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Check for failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(`${failures.length} orders failed to import`);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setImportPreviewModal(false);
      setImportData([]);
      setImportErrors([]);
      setMergedOrders([]);
      setImportProgress({ current: 0, total: 0 });
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${mergedOrders.length} orders.`,
      });
    },
    onError: (error: any) => {
      setImportProgress({ current: 0, total: 0 });
      toast({
        title: "Import failed",
        description: error.message || "Failed to import orders. Please try again.",
        variant: "destructive",
      });
    },
  });

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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Order Management</h1>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              data-testid="button-template-download"
            >
              <FileText className="h-4 w-4 mr-2" />
              Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportOrdersToCSV}
              disabled={orders.length === 0}
              data-testid="button-export-orders"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('import-file-input')?.click()}
              data-testid="button-import-orders"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input
              id="import-file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportFile(file);
                }
              }}
            />
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Total Orders: {orders.length}
          </p>
        </div>
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

      {/* Import Preview Modal */}
      <Dialog open={importPreviewModal} onOpenChange={() => setImportPreviewModal(false)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the data before final import
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Import Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{importData.length}</div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total Rows</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{mergedOrders.length}</div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Unique Orders</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${importErrors.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {importErrors.length}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Validation Errors</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Validation Errors */}
            {importErrors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    Validation Errors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {importErrors.map((error, index) => (
                      <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                        {error}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Merged Orders Preview */}
            {mergedOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Merged Orders Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order Number</TableHead>
                          <TableHead>Order Date</TableHead>
                          <TableHead>Items Count</TableHead>
                          <TableHead>Estimated Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mergedOrders.map((order, index) => {
                          // Calculate estimated total
                          let estimatedTotal = 0;
                          order.items.forEach((item: any) => {
                            let itemTotal = item.liveWeight * item.price;
                            let discount = 0;
                            if (item.discountPercentage > 0) {
                              discount += itemTotal * (item.discountPercentage / 100);
                            }
                            if (item.discountAmount > 0) {
                              discount += item.discountAmount;
                            }
                            estimatedTotal += Math.max(0, itemTotal - discount);
                          });
                          
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{order.orderNumber}</TableCell>
                              <TableCell>{order.orderDate}</TableCell>
                              <TableCell>{order.items.length} items</TableCell>
                              <TableCell>{formatCurrency(estimatedTotal)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress Indicator */}
            {submitImportMutation.isPending && importProgress.total > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Importing orders...</span>
                      <span>{importProgress.current} / {importProgress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Processing in batches to ensure reliable import...
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setImportPreviewModal(false)}
                disabled={submitImportMutation.isPending}
                data-testid="button-cancel-import"
              >
                Cancel
              </Button>
              <Button
                onClick={() => submitImportMutation.mutate()}
                disabled={mergedOrders.length === 0 || submitImportMutation.isPending}
                data-testid="button-confirm-import"
              >
                {submitImportMutation.isPending 
                  ? `Importing... (${importProgress.current}/${importProgress.total})` 
                  : `Import ${mergedOrders.length} Orders`}
              </Button>
            </div>
          </div>
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