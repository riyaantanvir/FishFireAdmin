import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, AlertTriangle, CheckCircle, XCircle, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Item, Order, OpeningStock, ClosingStock, InsertOpeningStock, InsertClosingStock } from "@shared/schema";

// Form validation schemas
const openingStockFormSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.enum(["PCS", "KG"]),
});

const closingStockFormSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unit: z.enum(["PCS", "KG"]),
});

type OpeningStockFormData = z.infer<typeof openingStockFormSchema>;
type ClosingStockFormData = z.infer<typeof closingStockFormSchema>;

interface StockReportRow {
  itemId: string;
  itemName: string;
  unit: string;
  opening: number;
  closing: number;
  sold: number;
  actualUsage: number;
  expectedUsage: number;
  difference: number;
  isMatch: boolean;
}

export default function StockReconciliation() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showOpeningForm, setShowOpeningForm] = useState(false);
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [editingOpening, setEditingOpening] = useState<OpeningStock | null>(null);
  const [editingClosing, setEditingClosing] = useState<ClosingStock | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: openingStock = [] } = useQuery<OpeningStock[]>({
    queryKey: [`/api/opening-stock/${selectedDate}`],
    enabled: !!selectedDate,
  });
  const { data: closingStock = [] } = useQuery<ClosingStock[]>({
    queryKey: [`/api/closing-stock/${selectedDate}`],
    enabled: !!selectedDate,
  });

  // Forms
  const openingForm = useForm<OpeningStockFormData>({
    resolver: zodResolver(openingStockFormSchema),
    defaultValues: {
      itemId: "",
      itemName: "",
      quantity: "",
      unit: "PCS",
    },
  });

  const closingForm = useForm<ClosingStockFormData>({
    resolver: zodResolver(closingStockFormSchema),
    defaultValues: {
      itemId: "",
      itemName: "",
      quantity: "",
      unit: "PCS",
    },
  });

  // Calculate sold quantities from orders for the selected date, tracking by unit
  const soldQuantities = useMemo(() => {
    const soldMap = new Map<string, { PCS: number; KG: number }>();
    
    const dayOrders = orders.filter(order => order.orderDate === selectedDate);
    
    dayOrders.forEach(order => {
      try {
        const orderItems = JSON.parse(order.items);
        if (orderItems.items && Array.isArray(orderItems.items)) {
          orderItems.items.forEach((item: any) => {
            const itemName = item.name;
            const liveWeight = parseFloat(item.liveWeight || 0);
            const itemSaleType = item.itemSaleType;
            const weightPerPCS = parseFloat(item.weightPerPCS || 0);
            
            if (!soldMap.has(itemName)) {
              soldMap.set(itemName, { PCS: 0, KG: 0 });
            }
            
            const soldData = soldMap.get(itemName)!;
            
            if (itemSaleType === "Per PCS") {
              // For PCS items: liveWeight is the quantity in pieces
              soldData.PCS += liveWeight;
              
              // Also calculate equivalent weight if we have weightPerPCS
              if (weightPerPCS > 0) {
                soldData.KG += liveWeight * weightPerPCS;
              }
            } else {
              // For KG items: liveWeight is the weight in KG
              soldData.KG += liveWeight;
            }
          });
        }
      } catch (error) {
        console.error('Error parsing order items:', error);
      }
    });
    
    return soldMap;
  }, [orders, selectedDate]);

  // Generate stock report
  const stockReport = useMemo((): StockReportRow[] => {
    const reportMap = new Map<string, StockReportRow>();

    // Add opening stock entries
    openingStock.forEach(stock => {
      const key = `${stock.itemId}-${stock.unit}`;
      const soldData = soldQuantities.get(stock.itemName) || { PCS: 0, KG: 0 };
      const expectedUsage = stock.unit === "PCS" ? soldData.PCS : soldData.KG;
      
      reportMap.set(key, {
        itemId: stock.itemId,
        itemName: stock.itemName,
        unit: stock.unit,
        opening: parseFloat(stock.quantity),
        closing: 0,
        sold: expectedUsage,
        actualUsage: 0,
        expectedUsage: expectedUsage,
        difference: 0,
        isMatch: false,
      });
    });

    // Add closing stock entries
    closingStock.forEach(stock => {
      const key = `${stock.itemId}-${stock.unit}`;
      const existing = reportMap.get(key);
      if (existing) {
        existing.closing = parseFloat(stock.quantity);
        existing.actualUsage = existing.opening - existing.closing;
        existing.difference = existing.actualUsage - existing.expectedUsage;
        existing.isMatch = Math.abs(existing.difference) < 0.001; // Account for floating point precision
      } else {
        const soldData = soldQuantities.get(stock.itemName) || { PCS: 0, KG: 0 };
        const expectedUsage = stock.unit === "PCS" ? soldData.PCS : soldData.KG;
        
        const row: StockReportRow = {
          itemId: stock.itemId,
          itemName: stock.itemName,
          unit: stock.unit,
          opening: 0,
          closing: parseFloat(stock.quantity),
          sold: expectedUsage,
          actualUsage: -parseFloat(stock.quantity), // Negative because we don't have opening
          expectedUsage: expectedUsage,
          difference: 0,
          isMatch: false,
        };
        row.difference = row.actualUsage - row.expectedUsage;
        row.isMatch = Math.abs(row.difference) < 0.001;
        reportMap.set(key, row);
      }
    });

    return Array.from(reportMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [openingStock, closingStock, soldQuantities]);

  // Count mismatches
  const mismatches = stockReport.filter(row => !row.isMatch);

  // Mutations
  const createOpeningStockMutation = useMutation({
    mutationFn: async (data: OpeningStockFormData) => {
      const stockData: InsertOpeningStock = {
        date: selectedDate,
        itemId: data.itemId,
        itemName: data.itemName,
        quantity: data.quantity,
        unit: data.unit,
      };
      return apiRequest("POST", "/api/opening-stock", stockData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/opening-stock/${selectedDate}`] });
      openingForm.reset();
      setShowOpeningForm(false);
      setEditingOpening(null);
      toast({ title: "Success", description: "Opening stock entry saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save opening stock.", variant: "destructive" });
    },
  });

  const updateOpeningStockMutation = useMutation({
    mutationFn: async (data: OpeningStockFormData) => {
      if (!editingOpening) return;
      return apiRequest("PUT", `/api/opening-stock/${editingOpening.id}`, {
        quantity: data.quantity,
        unit: data.unit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/opening-stock/${selectedDate}`] });
      openingForm.reset();
      setShowOpeningForm(false);
      setEditingOpening(null);
      toast({ title: "Success", description: "Opening stock entry updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update opening stock.", variant: "destructive" });
    },
  });

  const createClosingStockMutation = useMutation({
    mutationFn: async (data: ClosingStockFormData) => {
      const stockData: InsertClosingStock = {
        date: selectedDate,
        itemId: data.itemId,
        itemName: data.itemName,
        quantity: data.quantity,
        unit: data.unit,
      };
      return apiRequest("POST", "/api/closing-stock", stockData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/closing-stock/${selectedDate}`] });
      closingForm.reset();
      setShowClosingForm(false);
      setEditingClosing(null);
      toast({ title: "Success", description: "Closing stock entry saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save closing stock.", variant: "destructive" });
    },
  });

  const updateClosingStockMutation = useMutation({
    mutationFn: async (data: ClosingStockFormData) => {
      if (!editingClosing) return;
      return apiRequest("PUT", `/api/closing-stock/${editingClosing.id}`, {
        quantity: data.quantity,
        unit: data.unit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/closing-stock/${selectedDate}`] });
      closingForm.reset();
      setShowClosingForm(false);
      setEditingClosing(null);
      toast({ title: "Success", description: "Closing stock entry updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update closing stock.", variant: "destructive" });
    },
  });

  const deleteOpeningStockMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/opening-stock/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/opening-stock/${selectedDate}`] });
      toast({ title: "Success", description: "Opening stock entry deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete opening stock.", variant: "destructive" });
    },
  });

  const deleteClosingStockMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/closing-stock/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/closing-stock/${selectedDate}`] });
      toast({ title: "Success", description: "Closing stock entry deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete closing stock.", variant: "destructive" });
    },
  });

  // Handlers
  const handleOpeningSubmit = (data: OpeningStockFormData) => {
    if (editingOpening) {
      updateOpeningStockMutation.mutate(data);
    } else {
      createOpeningStockMutation.mutate(data);
    }
  };

  const handleClosingSubmit = (data: ClosingStockFormData) => {
    if (editingClosing) {
      updateClosingStockMutation.mutate(data);
    } else {
      createClosingStockMutation.mutate(data);
    }
  };

  const handleEditOpening = (stock: OpeningStock) => {
    setEditingOpening(stock);
    const selectedItem = items.find(item => item.id === stock.itemId);
    openingForm.reset({
      itemId: stock.itemId,
      itemName: stock.itemName,
      quantity: stock.quantity,
      unit: stock.unit as "PCS" | "KG",
    });
    setShowOpeningForm(true);
  };

  const handleEditClosing = (stock: ClosingStock) => {
    setEditingClosing(stock);
    closingForm.reset({
      itemId: stock.itemId,
      itemName: stock.itemName,
      quantity: stock.quantity,
      unit: stock.unit as "PCS" | "KG",
    });
    setShowClosingForm(true);
  };

  const handleItemSelect = (itemId: string, form: any, type: 'opening' | 'closing') => {
    const selectedItem = items.find(item => item.id === itemId);
    if (selectedItem) {
      form.setValue('itemId', itemId);
      form.setValue('itemName', selectedItem.name);
      
      // Set default unit based on item sale type
      const defaultUnit = selectedItem.itemSaleType === "Per PCS" ? "PCS" : "KG";
      form.setValue('unit', defaultUnit);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (stockReport.length === 0) {
      toast({
        title: "No data",
        description: "No stock data to export for this date.",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = ["Item", "Unit", "Opening", "Closing", "Sold (Orders)", "Actual Usage", "Expected Usage", "Difference", "Status"];
    const csvData = stockReport.map(row => [
      row.itemName,
      row.unit,
      row.opening.toFixed(3),
      row.closing.toFixed(3),
      row.sold.toFixed(3),
      row.actualUsage.toFixed(3),
      row.expectedUsage.toFixed(3),
      row.difference.toFixed(3),
      row.isMatch ? "Match" : "Mismatch",
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_reconciliation_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported stock reconciliation report for ${selectedDate}.`,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Stock Reconciliation</h1>
          <p className="text-muted-foreground">
            Track opening and closing stock to identify usage discrepancies
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          disabled={stockReport.length === 0}
          data-testid="button-export-stock-report"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
          <CardDescription>Choose the date for stock reconciliation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
              data-testid="input-reconciliation-date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mismatch Alerts */}
      {mismatches.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{mismatches.length} mismatch(es) found:</strong>{" "}
            {mismatches.map(item => item.itemName).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Stock Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Stock Reconciliation Report
            {stockReport.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({stockReport.filter(r => r.isMatch).length} matches, {mismatches.length} mismatches)
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Comparison of actual vs expected stock usage for {selectedDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Opening</TableHead>
                  <TableHead>Closing</TableHead>
                  <TableHead>Sold (Orders)</TableHead>
                  <TableHead>Actual Usage</TableHead>
                  <TableHead>Expected Usage</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No stock data entered for {selectedDate}. Use the tabs below to add opening and closing stock.
                    </TableCell>
                  </TableRow>
                ) : (
                  stockReport.map((row, index) => (
                    <TableRow
                      key={`${row.itemId}-${row.unit}`}
                      className={row.isMatch ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}
                      data-testid={`row-stock-${index}`}
                    >
                      <TableCell className="font-medium">{row.itemName}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{row.opening.toFixed(3)}</TableCell>
                      <TableCell>{row.closing.toFixed(3)}</TableCell>
                      <TableCell>{row.sold.toFixed(3)}</TableCell>
                      <TableCell>{row.actualUsage.toFixed(3)}</TableCell>
                      <TableCell>{row.expectedUsage.toFixed(3)}</TableCell>
                      <TableCell className={row.difference >= 0 ? "text-green-600" : "text-red-600"}>
                        {row.difference > 0 ? "+" : ""}{row.difference.toFixed(3)}
                      </TableCell>
                      <TableCell>
                        {row.isMatch ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Match
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            Mismatch
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Stock Entry Tabs */}
      <Tabs defaultValue="opening" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="opening">Opening Stock</TabsTrigger>
          <TabsTrigger value="closing">Closing Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="opening" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Opening Stock</CardTitle>
                  <CardDescription>Record the starting stock for each item</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingOpening(null);
                    openingForm.reset();
                    setShowOpeningForm(true);
                  }}
                  data-testid="button-add-opening-stock"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Opening Stock
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openingStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          No opening stock entries for {selectedDate}
                        </TableCell>
                      </TableRow>
                    ) : (
                      openingStock.map((stock) => (
                        <TableRow key={stock.id} data-testid={`row-opening-${stock.id}`}>
                          <TableCell>{stock.itemName}</TableCell>
                          <TableCell>{stock.quantity}</TableCell>
                          <TableCell>{stock.unit}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOpening(stock)}
                                data-testid={`button-edit-opening-${stock.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteOpeningStockMutation.mutate(stock.id)}
                                disabled={deleteOpeningStockMutation.isPending}
                                data-testid={`button-delete-opening-${stock.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Closing Stock</CardTitle>
                  <CardDescription>Record the ending stock for each item</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingClosing(null);
                    closingForm.reset();
                    setShowClosingForm(true);
                  }}
                  data-testid="button-add-closing-stock"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Closing Stock
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closingStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          No closing stock entries for {selectedDate}
                        </TableCell>
                      </TableRow>
                    ) : (
                      closingStock.map((stock) => (
                        <TableRow key={stock.id} data-testid={`row-closing-${stock.id}`}>
                          <TableCell>{stock.itemName}</TableCell>
                          <TableCell>{stock.quantity}</TableCell>
                          <TableCell>{stock.unit}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClosing(stock)}
                                data-testid={`button-edit-closing-${stock.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteClosingStockMutation.mutate(stock.id)}
                                disabled={deleteClosingStockMutation.isPending}
                                data-testid={`button-delete-closing-${stock.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Opening Stock Form Modal */}
      <Dialog open={showOpeningForm} onOpenChange={setShowOpeningForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOpening ? "Edit Opening Stock" : "Add Opening Stock"}</DialogTitle>
            <DialogDescription>
              Enter the starting stock quantity for an item on {selectedDate}
            </DialogDescription>
          </DialogHeader>
          <Form {...openingForm}>
            <form onSubmit={openingForm.handleSubmit(handleOpeningSubmit)} className="space-y-4">
              <FormField
                control={openingForm.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => handleItemSelect(value, openingForm, 'opening')}
                        value={field.value}
                        disabled={!!editingOpening}
                      >
                        <SelectTrigger data-testid="select-opening-item">
                          <SelectValue placeholder="Select an item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.itemSaleType})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={openingForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        {...field}
                        data-testid="input-opening-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={openingForm.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-testid="select-opening-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PCS">PCS</SelectItem>
                          <SelectItem value="KG">KG</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowOpeningForm(false)}
                  data-testid="button-cancel-opening"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createOpeningStockMutation.isPending || updateOpeningStockMutation.isPending}
                  data-testid="button-save-opening"
                >
                  {editingOpening ? "Update" : "Add"} Opening Stock
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Closing Stock Form Modal */}
      <Dialog open={showClosingForm} onOpenChange={setShowClosingForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClosing ? "Edit Closing Stock" : "Add Closing Stock"}</DialogTitle>
            <DialogDescription>
              Enter the ending stock quantity for an item on {selectedDate}
            </DialogDescription>
          </DialogHeader>
          <Form {...closingForm}>
            <form onSubmit={closingForm.handleSubmit(handleClosingSubmit)} className="space-y-4">
              <FormField
                control={closingForm.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => handleItemSelect(value, closingForm, 'closing')}
                        value={field.value}
                        disabled={!!editingClosing}
                      >
                        <SelectTrigger data-testid="select-closing-item">
                          <SelectValue placeholder="Select an item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.itemSaleType})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={closingForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        {...field}
                        data-testid="input-closing-quantity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={closingForm.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-testid="select-closing-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PCS">PCS</SelectItem>
                          <SelectItem value="KG">KG</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowClosingForm(false)}
                  data-testid="button-cancel-closing"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createClosingStockMutation.isPending || updateClosingStockMutation.isPending}
                  data-testid="button-save-closing"
                >
                  {editingClosing ? "Update" : "Add"} Closing Stock
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}