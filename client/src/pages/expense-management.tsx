import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Download, Upload, Plus, Edit, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Expense, InsertExpense } from "@shared/schema";

// Form validation schema
const expenseFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  personItem: z.string().min(1, "Person/Item is required"),
  category: z.string().min(1, "Category is required"),
  weight: z.string().optional(),
  qty: z.string().min(1, "Quantity is required"),
  amount: z.string().min(1, "Amount is required"),
  dueAmount: z.string().optional(),
  comment: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

export default function ExpenseManagement() {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Form setup
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      personItem: "",
      category: "",
      weight: "",
      qty: "1",
      amount: "",
      dueAmount: "",
      comment: "",
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const expenseData: InsertExpense = {
        date: data.date,
        personItem: data.personItem,
        category: data.category,
        weight: data.weight ? data.weight : null,
        qty: parseInt(data.qty),
        amount: data.amount,
        dueAmount: data.dueAmount ? data.dueAmount : null,
        comment: data.comment || null,
      };
      return apiRequest("POST", "/api/expenses", expenseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      form.reset();
      setShowAddForm(false);
      toast({
        title: "Success",
        description: "Expense created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create expense.",
        variant: "destructive",
      });
    },
  });

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      if (!editingExpense) return;
      const expenseData = {
        date: data.date,
        personItem: data.personItem,
        category: data.category,
        weight: data.weight ? data.weight : null,
        qty: parseInt(data.qty),
        amount: data.amount,
        dueAmount: data.dueAmount ? data.dueAmount : null,
        comment: data.comment || null,
      };
      return apiRequest("PUT", `/api/expenses/${editingExpense.id}`, expenseData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      form.reset();
      setEditingExpense(null);
      toast({
        title: "Success",
        description: "Expense updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update expense.",
        variant: "destructive",
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Success",
        description: "Expense deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete expense.",
        variant: "destructive",
      });
    },
  });

  // Import expenses mutation with batch processing
  const importExpensesMutation = useMutation({
    mutationFn: async () => {
      const BATCH_SIZE = 10; // Process 10 expenses at a time
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process in batches
      for (let i = 0; i < importData.length; i += BATCH_SIZE) {
        const batch = importData.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (expense, index) => {
          try {
            const expenseData: InsertExpense = {
              date: expense.Date,
              personItem: expense["Person/Item"],
              category: expense.Category,
              weight: expense.Weight || null,
              qty: parseInt(expense.Qty) || 1,
              amount: expense.Amount,
              dueAmount: expense["Due Amount"] || null,
              comment: expense.Comment || null,
            };
            
            const result = await apiRequest("POST", "/api/expenses", expenseData);
            successCount++;
            return { success: true, index: i + index, result };
          } catch (error) {
            errorCount++;
            console.error(`Failed to import expense at row ${i + index + 2}:`, error);
            return { success: false, index: i + index, error };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to prevent overwhelming the server
        if (i + BATCH_SIZE < importData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return { successCount, errorCount, totalCount: importData.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setImportModal(false);
      setImportData([]);
      setImportErrors([]);
      
      if (result.errorCount > 0) {
        toast({
          title: "Import completed with errors",
          description: `Successfully imported ${result.successCount} out of ${result.totalCount} expenses. ${result.errorCount} failed.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import successful",
          description: `Successfully imported all ${result.successCount} expenses.`,
        });
      }
    },
    onError: (error) => {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: "Failed to import expenses. Please check your CSV format and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ExpenseFormData) => {
    if (editingExpense) {
      updateExpenseMutation.mutate(data);
    } else {
      createExpenseMutation.mutate(data);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setShowAddForm(true);
    form.reset({
      date: expense.date,
      personItem: expense.personItem,
      category: expense.category,
      weight: expense.weight || "",
      qty: expense.qty.toString(),
      amount: expense.amount,
      dueAmount: expense.dueAmount || "",
      comment: expense.comment || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
    setShowAddForm(false);
    form.reset();
  };

  // CSV Export
  const handleExport = () => {
    if (expenses.length === 0) {
      toast({
        title: "No data",
        description: "No expenses to export.",
        variant: "destructive",
      });
      return;
    }

    const csvHeaders = ["Date", "Person/Item", "Category", "Weight", "Qty", "Amount", "Due Amount", "Comment"];
    const csvData = expenses.map(expense => [
      expense.date,
      expense.personItem,
      expense.category,
      expense.weight || "",
      expense.qty,
      expense.amount,
      expense.dueAmount || "",
      expense.comment || "",
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${expenses.length} expenses to CSV.`,
    });
  };

  // Example CSV Export
  const handleExampleExport = () => {
    const csvHeaders = ["Date", "Person/Item", "Category", "Weight", "Qty", "Amount", "Due Amount", "Comment"];
    const exampleData = [
      ["2024-01-15", "Fish Supplier A", "Raw Materials", "25.5", "1", "2500.00", "0.00", "Fresh Hilsa fish purchase"],
      ["2024-01-15", "Electricity Company", "Utilities", "", "1", "800.00", "200.00", "Monthly electricity bill"],
      ["2024-01-16", "Transport Service", "Transportation", "", "1", "300.00", "0.00", "Fish delivery to market"],
      ["2024-01-16", "Ice Supplier", "Consumables", "50", "1", "150.00", "0.00", "Ice for fish preservation"],
      ["2024-01-17", "Staff Salary", "Labor", "", "1", "5000.00", "0.00", "Monthly salary payment"],
      ["2024-01-17", "Market Rent", "Rent", "", "1", "1200.00", "0.00", "Shop rent for January"],
      ["2024-01-18", "Packaging Materials", "Supplies", "10", "5", "250.00", "0.00", "Polythene bags and boxes"],
    ];

    const csvContent = [csvHeaders, ...exampleData]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expense_example.csv";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Example CSV downloaded",
      description: "Sample expense data exported successfully.",
    });
  };

  // Improved CSV parsing function
  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Handle escaped quotes
          current += '"';
          i++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  // CSV Import with improved parsing
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length === 0) {
          setImportErrors(["CSV file is empty"]);
          setImportModal(true);
          return;
        }

        const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim());
        
        const requiredHeaders = ["Date", "Person/Item", "Category", "Qty", "Amount"];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          setImportErrors([`Missing required columns: ${missingHeaders.join(", ")}`]);
          setImportModal(true);
          return;
        }

        const errors: string[] = [];
        const data = lines.slice(1).map((line, index) => {
          try {
            const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, "").trim());
            const row: any = {};
            
            headers.forEach((header, i) => {
              row[header] = values[i] || "";
            });

            // Validate required fields
            if (!row.Date || !row["Person/Item"] || !row.Category || !row.Amount) {
              errors.push(`Row ${index + 2}: Missing required data`);
            }

            // Validate date format
            if (row.Date && isNaN(Date.parse(row.Date))) {
              errors.push(`Row ${index + 2}: Invalid date format`);
            }

            // Validate amount is numeric
            if (row.Amount && isNaN(parseFloat(row.Amount))) {
              errors.push(`Row ${index + 2}: Amount must be a number`);
            }

            return row;
          } catch (error) {
            errors.push(`Row ${index + 2}: Error parsing line`);
            return null;
          }
        }).filter(row => row !== null);

        if (errors.length > 10) {
          setImportErrors([`Too many errors in CSV file (${errors.length} errors). Please check your file format.`, ...errors.slice(0, 10), "... and more"]);
        } else if (errors.length > 0) {
          setImportErrors(errors);
        } else {
          setImportErrors([]);
        }

        setImportData(data);
        setImportModal(true);
      } catch (error) {
        console.error("CSV parsing error:", error);
        setImportErrors(["Failed to parse CSV file. Please check the file format."]);
        setImportModal(true);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Calculate total amounts
  const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  const totalDueAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.dueAmount || "0"), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Management</h1>
          <p className="text-muted-foreground">
            Track and manage business expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={expenses.length === 0}
            data-testid="button-export-expenses"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExampleExport}
            data-testid="button-example-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Example CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById("import-input")?.click()}
            data-testid="button-import-expenses"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            data-testid="button-add-expense"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      <input
        id="import-input"
        type="file"
        accept=".csv"
        onChange={handleImport}
        style={{ display: "none" }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-expenses">
              TK {totalAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenses.length} total expenses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Due</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-due">
              TK {totalDueAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding amount
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-paid-amount">
              TK {(totalAmount - totalDueAmount).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount paid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</CardTitle>
            <CardDescription>
              {editingExpense ? "Update expense details" : "Enter expense information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-expense-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="personItem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Person/Item</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-expense-person-item" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger data-testid="select-expense-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Food & Supplies">Food & Supplies</SelectItem>
                              <SelectItem value="Equipment">Equipment</SelectItem>
                              <SelectItem value="Transport">Transport</SelectItem>
                              <SelectItem value="Utilities">Utilities</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" {...field} data-testid="input-expense-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="qty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-expense-qty" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-expense-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Amount (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-expense-due-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comment (optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-expense-comment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
                    data-testid="button-save-expense"
                  >
                    {editingExpense ? "Update Expense" : "Add Expense"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    data-testid="button-cancel-expense"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>
            {expensesLoading ? "Loading..." : `${expenses.length} expense(s) found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Person/Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Amount</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expensesLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Loading expenses...
                    </TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No expenses found. Add your first expense to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                      <TableCell>{expense.date}</TableCell>
                      <TableCell>{expense.personItem}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{expense.weight || "-"}</TableCell>
                      <TableCell>{expense.qty}</TableCell>
                      <TableCell>TK {expense.amount}</TableCell>
                      <TableCell>{expense.dueAmount ? `TK ${expense.dueAmount}` : "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {expense.comment || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(expense)}
                            data-testid={`button-edit-${expense.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteExpenseMutation.mutate(expense.id)}
                            disabled={deleteExpenseMutation.isPending}
                            data-testid={`button-delete-${expense.id}`}
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

      {/* Import Modal */}
      <Dialog open={importModal} onOpenChange={setImportModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Import Expenses</DialogTitle>
            <DialogDescription>
              Preview and import expense data from CSV
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {importErrors.length > 0 && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <CardHeader>
                  <CardTitle className="text-red-800 dark:text-red-200">Import Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-4 space-y-1">
                    {importErrors.map((error, index) => (
                      <li key={index} className="text-red-700 dark:text-red-300">{error}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            
            {importData.length > 0 && (
              <>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Preview ({importData.length} expenses)</h3>
                  <div className="max-h-96 overflow-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Person/Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Amount</TableHead>
                          <TableHead>Comment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importData.slice(0, 10).map((expense, index) => (
                          <TableRow key={index}>
                            <TableCell>{expense.Date}</TableCell>
                            <TableCell>{expense["Person/Item"]}</TableCell>
                            <TableCell>{expense.Category}</TableCell>
                            <TableCell>{expense.Weight || "-"}</TableCell>
                            <TableCell>{expense.Qty}</TableCell>
                            <TableCell>{expense.Amount}</TableCell>
                            <TableCell>{expense["Due Amount"] || "-"}</TableCell>
                            <TableCell>{expense.Comment || "-"}</TableCell>
                          </TableRow>
                        ))}
                        {importData.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
                              ... and {importData.length - 10} more expenses
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setImportModal(false)}
                    data-testid="button-cancel-import"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => importExpensesMutation.mutate()}
                    disabled={importData.length === 0 || importExpensesMutation.isPending || importErrors.length > 0}
                    data-testid="button-confirm-import"
                  >
                    {importExpensesMutation.isPending ? "Importing..." : `Import ${importData.length} Expenses`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}