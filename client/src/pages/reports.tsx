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

  // Calculate cash counter data
  const cashCounter = paymentReports.reduce((acc, payment) => {
    acc.cash1000 += payment.cash1000 || 0;
    acc.cash500 += payment.cash500 || 0;
    acc.cash200 += payment.cash200 || 0;
    acc.cash100 += payment.cash100 || 0;
    acc.cash50 += payment.cash50 || 0;
    acc.cash20 += payment.cash20 || 0;
    acc.cash10 += payment.cash10 || 0;
    acc.cash5 += payment.cash5 || 0;
    acc.cash2 += payment.cash2 || 0;
    acc.cash1 += payment.cash1 || 0;
    acc.totalCash += Number(payment.totalCash || 0);
    acc.bkash += Number(payment.bkash || 0);
    acc.rocket += Number(payment.rocket || 0);
    acc.nogod += Number(payment.nogod || 0);
    acc.card += Number(payment.card || 0);
    acc.bank += Number(payment.bank || 0);
    acc.totalDigital += Number(payment.totalDigital || 0);
    return acc;
  }, {
    cash1000: 0, cash500: 0, cash200: 0, cash100: 0, cash50: 0,
    cash20: 0, cash10: 0, cash5: 0, cash2: 0, cash1: 0,
    totalCash: 0, bkash: 0, rocket: 0, nogod: 0, card: 0, bank: 0, totalDigital: 0
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
    a.download = `${filename}_${dateFrom}_to_${dateTo}.csv`;
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
    doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 20, 35);
    
    // Add table
    autoTable(doc, {
      startY: 45,
      head: [headers],
      body: data.map(row => dataKeys.map(key => row[key] || '')),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }, // Blue header
    });
    
    // Save the PDF
    doc.save(`${filename}_${dateFrom}_to_${dateTo}.pdf`);
  };

  const isLoading = ordersLoading || paymentsLoading;

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

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
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
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDateFrom(new Date().toISOString().split('T')[0]);
                  setDateTo(new Date().toISOString().split('T')[0]);
                }}
                data-testid="button-today"
              >
                Today
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="payment-summary" data-testid="tab-payment-summary">
            <DollarSign className="h-4 w-4 mr-2" />
            Payment Summary
          </TabsTrigger>
          <TabsTrigger value="cash-counter" data-testid="tab-cash-counter">
            <Calculator className="h-4 w-4 mr-2" />
            Cash Counter
          </TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">
            <TrendingUp className="h-4 w-4 mr-2" />
            Sales Report
          </TabsTrigger>
          <TabsTrigger value="outstanding" data-testid="tab-outstanding">
            <AlertCircle className="h-4 w-4 mr-2" />
            Outstanding
          </TabsTrigger>
        </TabsList>

        {/* Payment Summary Tab */}
        <TabsContent value="payment-summary" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Payment Summary Report</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV([paymentSummary], 'payment_summary')}
                variant="outline"
                data-testid="button-export-payment-summary-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportToPDF(
                  [paymentSummary], 
                  'payment_summary', 
                  'Payment Summary Report',
                  ['Metric', 'Value'],
                  ['totalOrders', 'totalRevenue', 'paidAmount', 'outstandingAmount']
                )}
                variant="outline"
                data-testid="button-export-payment-summary-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-orders">
                  {paymentSummary.totalOrders}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-revenue">
                  TK {paymentSummary.totalRevenue.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-paid-amount">
                  TK {paymentSummary.paidAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-outstanding-amount">
                  TK {paymentSummary.outstandingAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Badge variant="default">Paid</Badge>
                  <span className="text-lg font-medium">{paymentSummary.paidOrders} orders</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">Partial</Badge>
                  <span className="text-lg font-medium">{paymentSummary.partialOrders} orders</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="destructive">Unpaid</Badge>
                  <span className="text-lg font-medium">{paymentSummary.unpaidOrders} orders</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash Counter Tab */}
        <TabsContent value="cash-counter" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Cash Counter Report</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV([cashCounter], 'cash_counter')}
                variant="outline"
                data-testid="button-export-cash-counter-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportToPDF(
                  [cashCounter], 
                  'cash_counter', 
                  'Cash Counter Report',
                  ['Item', 'Count/Amount'],
                  ['cash1000', 'cash500', 'cash200', 'cash100', 'totalCash', 'totalDigital']
                )}
                variant="outline"
                data-testid="button-export-cash-counter-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Cash Notes Breakdown</CardTitle>
                <CardDescription>Note-wise cash collection summary</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Note</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { note: "TK 1000", count: cashCounter.cash1000, amount: cashCounter.cash1000 * 1000 },
                      { note: "TK 500", count: cashCounter.cash500, amount: cashCounter.cash500 * 500 },
                      { note: "TK 200", count: cashCounter.cash200, amount: cashCounter.cash200 * 200 },
                      { note: "TK 100", count: cashCounter.cash100, amount: cashCounter.cash100 * 100 },
                      { note: "TK 50", count: cashCounter.cash50, amount: cashCounter.cash50 * 50 },
                      { note: "TK 20", count: cashCounter.cash20, amount: cashCounter.cash20 * 20 },
                      { note: "TK 10", count: cashCounter.cash10, amount: cashCounter.cash10 * 10 },
                      { note: "TK 5", count: cashCounter.cash5, amount: cashCounter.cash5 * 5 },
                      { note: "TK 2", count: cashCounter.cash2, amount: cashCounter.cash2 * 2 },
                      { note: "TK 1", count: cashCounter.cash1, amount: cashCounter.cash1 * 1 },
                    ].map((item) => (
                      <TableRow key={item.note}>
                        <TableCell className="font-medium">{item.note}</TableCell>
                        <TableCell>{item.count}</TableCell>
                        <TableCell>TK {item.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold">
                    Total Cash: TK {cashCounter.totalCash.toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Digital Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Digital Payments</CardTitle>
                <CardDescription>Digital payment methods summary</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">bKash</TableCell>
                      <TableCell>TK {cashCounter.bkash.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Rocket</TableCell>
                      <TableCell>TK {cashCounter.rocket.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Nogod</TableCell>
                      <TableCell>TK {cashCounter.nogod.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Card</TableCell>
                      <TableCell>TK {cashCounter.card.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Bank Transfer</TableCell>
                      <TableCell>TK {cashCounter.bank.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-lg font-bold">
                    Total Digital: TK {cashCounter.totalDigital.toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Total Cash</Label>
                  <div className="text-2xl font-bold">TK {cashCounter.totalCash.toLocaleString()}</div>
                </div>
                <div>
                  <Label>Total Digital</Label>
                  <div className="text-2xl font-bold">TK {cashCounter.totalDigital.toLocaleString()}</div>
                </div>
                <div>
                  <Label>Grand Total</Label>
                  <div className="text-2xl font-bold text-green-600">
                    TK {(cashCounter.totalCash + cashCounter.totalDigital).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Report Tab */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Sales Report</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV(filteredOrders, 'sales_report')}
                variant="outline"
                data-testid="button-export-sales-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => exportToPDF(
                  filteredOrders, 
                  'sales_report', 
                  'Sales Report',
                  ['Order Number', 'Customer', 'Date', 'Amount', 'Payment Status'],
                  ['orderNumber', 'customerName', 'orderDate', 'totalAmount', 'paymentStatus']
                )}
                variant="outline"
                data-testid="button-export-sales-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} data-testid={`sales-row-${order.id}`}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 
                         order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>TK {Number(order.totalAmount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            order.paymentStatus === 'Paid' ? 'default' :
                            order.paymentStatus === 'Partial' ? 'secondary' : 'destructive'
                          }
                        >
                          {order.paymentStatus || 'Unpaid'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No sales data available for the selected date range.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding Report Tab */}
        <TabsContent value="outstanding" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Outstanding Report</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => exportToCSV(
                  filteredOrders.filter(order => order.paymentStatus !== 'Paid'),
                  'outstanding_report'
                )}
                variant="outline"
                data-testid="button-export-outstanding-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => {
                  const outstandingOrders = filteredOrders.filter(order => order.paymentStatus !== 'Paid');
                  exportToPDF(
                    outstandingOrders, 
                    'outstanding_report', 
                    'Outstanding Payments Report',
                    ['Order Number', 'Customer', 'Date', 'Amount', 'Status', 'Days Overdue'],
                    ['orderNumber', 'customerName', 'orderDate', 'totalAmount', 'paymentStatus', 'daysOverdue']
                  );
                }}
                variant="outline"
                data-testid="button-export-outstanding-pdf"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Unpaid & Partial Orders</CardTitle>
              <CardDescription>Orders with pending payments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders
                    .filter(order => order.paymentStatus !== 'Paid')
                    .map((order) => {
                      const orderDate = new Date(order.orderDate || order.createdAt || '');
                      const today = new Date();
                      const daysOverdue = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <TableRow key={order.id} data-testid={`outstanding-row-${order.id}`}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell>{orderDate.toLocaleDateString()}</TableCell>
                          <TableCell>TK {Number(order.totalAmount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={order.paymentStatus === 'Partial' ? 'secondary' : 'destructive'}>
                              {order.paymentStatus || 'Unpaid'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={daysOverdue > 7 ? 'text-red-600 font-medium' : ''}>
                              {daysOverdue} days
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              {filteredOrders.filter(order => order.paymentStatus !== 'Paid').length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="text-green-600 font-medium">
                    🎉 No outstanding payments! All orders are paid.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}