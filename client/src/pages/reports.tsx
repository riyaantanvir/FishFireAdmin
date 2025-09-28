import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, DollarSign, Calculator, TrendingUp, AlertCircle, FileText, Package, Receipt, Banknote } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import type { Order, Payment, Expense, Item, OpeningStock, ClosingStock } from "@shared/schema";

export default function Reports() {
  const [filterType, setFilterType] = useState("today");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Calculate date ranges based on filter type
  const getDateRange = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    switch (filterType) {
      case "today":
        return {
          from: today.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
      case "yesterday":
        return {
          from: yesterday.toISOString().split('T')[0],
          to: yesterday.toISOString().split('T')[0]
        };
      case "this-month":
        return {
          from: thisMonthStart.toISOString().split('T')[0],
          to: thisMonthEnd.toISOString().split('T')[0]
        };
      case "last-month":
        return {
          from: lastMonthStart.toISOString().split('T')[0],
          to: lastMonthEnd.toISOString().split('T')[0]
        };
      case "custom":
        return { from: dateFrom, to: dateTo };
      case "all":
        return { from: "2020-01-01", to: "2099-12-31" };
      default:
        return {
          from: today.toISOString().split('T')[0],
          to: today.toISOString().split('T')[0]
        };
    }
  };

  const currentDateRange = getDateRange();

  // Fetch all required data
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: paymentReports = [], isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ["/api/payment-reports", currentDateRange],
    queryFn: async () => {
      const response = await fetch(`/api/payment-reports?dateFrom=${currentDateRange.from}&dateTo=${currentDateRange.to}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error('Failed to fetch payment reports');
      }
      return response.json();
    },
  });

  // Fetch opening and closing stock for current date range  
  const { data: openingStock = [], isLoading: openingStockLoading } = useQuery<OpeningStock[]>({
    queryKey: ["/api/opening-stock", currentDateRange.from],
  });

  const { data: closingStock = [], isLoading: closingStockLoading } = useQuery<ClosingStock[]>({
    queryKey: ["/api/closing-stock", currentDateRange.to],
  });

  // Filter data by date range
  const filteredOrders = orders.filter(order => {
    const orderDate = order.orderDate || (order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '');
    return orderDate >= currentDateRange.from && orderDate <= currentDateRange.to;
  });

  const filteredExpenses = expenses.filter(expense => {
    const expenseDate = expense.date || (expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : '');
    return expenseDate >= currentDateRange.from && expenseDate <= currentDateRange.to;
  });

  // Calculate summary data for cards
  const totalOrders = filteredOrders.length;
  const totalSales = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const netProfit = totalSales - totalExpenses;

  // Calculate stock report data
  const stockReportData = items.map(item => {
    const openingQty = openingStock
      .filter(stock => stock.itemId === item.id)
      .reduce((sum, stock) => sum + parseFloat(stock.quantity), 0);
    
    const closingQty = closingStock
      .filter(stock => stock.itemId === item.id)
      .reduce((sum, stock) => sum + parseFloat(stock.quantity), 0);

    // Calculate sold quantity from filtered orders
    const soldQty = filteredOrders.reduce((total, order) => {
      try {
        const items = JSON.parse(order.items);
        const orderItems = Array.isArray(items) ? items : items.items || [];
        const itemSales = orderItems
          .filter((orderItem: any) => orderItem.itemId === item.id || orderItem.name === item.name)
          .reduce((sum: number, orderItem: any) => sum + (orderItem.liveWeight || 0), 0);
        return total + itemSales;
      } catch {
        return total;
      }
    }, 0);

    return {
      item: item.name,
      openingStock: openingQty,
      sold: soldQty,
      closingStock: closingQty,
      availableStock: closingQty
    };
  });

  // Prepare payment & sales report data
  const paymentSalesData = filteredOrders.map(order => {
    const payment = paymentReports.find(p => p.orderId === order.id);
    const paymentMethod = payment ? 
      (payment.totalCash > 0 ? 'Cash' : '') + 
      (payment.bkash > 0 ? 'bKash ' : '') +
      (payment.rocket > 0 ? 'Rocket ' : '') +
      (payment.nogod > 0 ? 'Nogod ' : '') +
      (payment.card > 0 ? 'Card ' : '') +
      (payment.bank > 0 ? 'Bank ' : '') || 'N/A'
      : 'N/A';
    
    const paidAmount = payment ? 
      Number(payment.totalCash || 0) + Number(payment.totalDigital || 0) : 0;

    return {
      date: order.orderDate || (order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : ''),
      orderNo: order.orderNumber,
      customer: order.customerName,
      totalBill: Number(order.totalAmount),
      paymentMethod,
      paidAmount,
      status: order.paymentStatus || 'Unpaid'
    };
  });

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => 
        typeof row[header] === 'string' && row[header].includes(',') 
          ? `"${row[header]}"` 
          : row[header]
      ).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${currentDateRange.from}_to_${currentDateRange.to}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export to PDF function
  const exportToPDF = (data: any[], filename: string, title: string, headers: string[], dataKeys: string[]) => {
    if (data.length === 0) return;
    
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 20, 20);
    
    // Add date range
    doc.setFontSize(12);
    doc.text(`Date Range: ${currentDateRange.from} to ${currentDateRange.to}`, 20, 35);
    
    // Add table
    autoTable(doc, {
      startY: 45,
      head: [headers],
      body: data.map(row => dataKeys.map(key => row[key] || '')),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }, // Blue header
    });
    
    // Save the PDF
    doc.save(`${filename}_${currentDateRange.from}_to_${currentDateRange.to}.pdf`);
  };

  const isLoading = ordersLoading || paymentsLoading || expensesLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive reporting and analytics for your business
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center flex-wrap">
            <div>
              <Label htmlFor="filter-type">Filter</Label>
              <Select 
                value={filterType} 
                onValueChange={setFilterType}
                data-testid="select-filter-type"
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                  <SelectItem value="all">All Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {filterType === "custom" && (
              <>
                <div>
                  <Label htmlFor="date-from">From Date</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    data-testid="input-date-from"
                  />
                </div>
                <div>
                  <Label htmlFor="date-to">To Date</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    data-testid="input-date-to"
                  />
                </div>
              </>
            )}
            
            <div className="text-sm text-muted-foreground">
              Showing data from {currentDateRange.from} to {currentDateRange.to}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="card-total-orders">
              {totalOrders}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="card-total-sales">
              TK {totalSales.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="card-total-expenses">
              TK {totalExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="card-net-profit">
              TK {netProfit.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment & Sales Report */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Payment & Sales Report</CardTitle>
              <CardDescription>
                Detailed view of orders with payment information
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV(paymentSalesData, 'payment_sales_report')}
                variant="outline"
                data-testid="button-export-payment-sales-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportToPDF(
                  paymentSalesData, 
                  'payment_sales_report', 
                  'Payment & Sales Report',
                  ['Date', 'Order No', 'Customer', 'Total Bill', 'Payment Method', 'Paid Amount', 'Status'],
                  ['date', 'orderNo', 'customer', 'totalBill', 'paymentMethod', 'paidAmount', 'status']
                )}
                variant="outline"
                data-testid="button-export-payment-sales-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total Bill</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Paid Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentSalesData.map((row, index) => (
                  <TableRow key={index} data-testid={`payment-sales-row-${index}`}>
                    <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{row.orderNo}</TableCell>
                    <TableCell>{row.customer}</TableCell>
                    <TableCell>TK {row.totalBill.toLocaleString()}</TableCell>
                    <TableCell>{row.paymentMethod}</TableCell>
                    <TableCell>TK {row.paidAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          row.status === 'Paid' ? 'default' :
                          row.status === 'Partial' ? 'secondary' : 'destructive'
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {paymentSalesData.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No payment & sales data available for the selected period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Report */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Stock Report</CardTitle>
              <CardDescription>
                Inventory overview with opening, sold, and closing stock
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV(stockReportData, 'stock_report')}
                variant="outline"
                data-testid="button-export-stock-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportToPDF(
                  stockReportData, 
                  'stock_report', 
                  'Stock Report',
                  ['Item', 'Opening Stock', 'Sold', 'Closing Stock', 'Available Stock'],
                  ['item', 'openingStock', 'sold', 'closingStock', 'availableStock']
                )}
                variant="outline"
                data-testid="button-export-stock-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Opening Stock</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Closing Stock</TableHead>
                  <TableHead>Available Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockReportData.map((row, index) => (
                  <TableRow key={index} data-testid={`stock-row-${index}`}>
                    <TableCell className="font-medium">{row.item}</TableCell>
                    <TableCell>{row.openingStock.toFixed(2)}</TableCell>
                    <TableCell>{row.sold.toFixed(2)}</TableCell>
                    <TableCell>{row.closingStock.toFixed(2)}</TableCell>
                    <TableCell>{row.availableStock.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {stockReportData.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No stock data available for the selected period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Report */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Expense Report</CardTitle>
              <CardDescription>
                Detailed breakdown of all expenses
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV(filteredExpenses.map(expense => ({
                  date: expense.date || (expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : ''),
                  expenseType: expense.category,
                  amount: Number(expense.amount),
                  notes: expense.comment || ''
                })), 'expense_report')}
                variant="outline"
                data-testid="button-export-expense-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportToPDF(
                  filteredExpenses.map(expense => ({
                    date: expense.date || (expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : ''),
                    expenseType: expense.category,
                    amount: Number(expense.amount),
                    notes: expense.comment || ''
                  })), 
                  'expense_report', 
                  'Expense Report',
                  ['Date', 'Expense Type', 'Amount', 'Notes'],
                  ['date', 'expenseType', 'amount', 'notes']
                )}
                variant="outline"
                data-testid="button-export-expense-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Expense Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id} data-testid={`expense-row-${expense.id}`}>
                    <TableCell>
                      {expense.date ? 
                        new Date(expense.date).toLocaleDateString() : 
                        expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : 'N/A'
                      }
                    </TableCell>
                    <TableCell className="font-medium">{expense.category}</TableCell>
                    <TableCell>TK {Number(expense.amount).toLocaleString()}</TableCell>
                    <TableCell>{expense.comment || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filteredExpenses.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No expense data available for the selected period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}