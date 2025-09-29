import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Download, Upload, Plus, Edit, DollarSign, AlertTriangle, ChevronLeft, ChevronRight, Filter, Calendar, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";
import { apiRequest } from "@/lib/queryClient";
import type { Expense, InsertExpense, ExpenseCategory } from "@shared/schema";

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
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissions();
  
  // Filter states
  const [dateFilter, setDateFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
    enabled: canView("expenses"), // Only fetch if user can view expenses
  });

  // Fetch expense categories
  const { data: expenseCategories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  // Original pagination calculations (kept for backward compatibility)
  const totalExpenses = expenses.length;
  const totalPages = Math.ceil(totalExpenses / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedExpenses = expenses.slice(startIndex, endIndex);

  // Reset to first page when page size changes
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  // Filter functions
  const getDateRange = (filter: string) => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    switch (filter) {
      case "today":
        return {
          start: format(startOfToday, "yyyy-MM-dd"),
          end: format(startOfToday, "yyyy-MM-dd")
        };
      case "yesterday": {
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: format(yesterday, "yyyy-MM-dd"),
          end: format(yesterday, "yyyy-MM-dd")
        };
      }
      case "thisWeek": {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return {
          start: format(startOfWeek, "yyyy-MM-dd"),
          end: format(startOfToday, "yyyy-MM-dd")
        };
      }
      case "thisMonth": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          start: format(startOfMonth, "yyyy-MM-dd"),
          end: format(startOfToday, "yyyy-MM-dd")
        };
      }
      case "lastMonth": {
        const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: format(startOfLastMonth, "yyyy-MM-dd"),
          end: format(endOfLastMonth, "yyyy-MM-dd")
        };
      }
      case "custom":
        // Only apply custom filter if both dates are provided
        if (customDateFrom && customDateTo) {
          return {
            start: customDateFrom,
            end: customDateTo
          };
        }
        return null; // Skip filtering if dates are not complete
      default:
        return null;
    }
  };

  // Apply all filters to expenses
  const filteredExpenses = expenses.filter(expense => {
    // Date filter
    if (dateFilter !== "all") {
      const dateRange = getDateRange(dateFilter);
      if (dateRange && dateRange.start && dateRange.end) {
        if (expense.date < dateRange.start || expense.date > dateRange.end) {
          return false;
        }
      }
    }

    // Category filter
    if (categoryFilter !== "all" && expense.category !== categoryFilter) {
      return false;
    }

    // Amount filter
    if (amountFilter !== "all") {
      const amount = parseFloat(expense.amount);
      switch (amountFilter) {
        case "high":
          if (amount < 1000) return false;
          break;
        case "medium":
          if (amount < 100 || amount >= 1000) return false;
          break;
        case "low":
          if (amount >= 100) return false;
          break;
      }
    }

    // Payment status filter
    if (paymentFilter !== "all") {
      const dueAmount = parseFloat(expense.dueAmount || "0");
      switch (paymentFilter) {
        case "paid":
          if (dueAmount > 0) return false;
          break;
        case "partial":
          if (dueAmount === 0) return false;
          break;
      }
    }

    return true;
  });

  // Update pagination calculations to use filtered data
  const totalFilteredExpenses = filteredExpenses.length;
  const filteredTotalPages = Math.ceil(totalFilteredExpenses / pageSize);
  const filteredStartIndex = (currentPage - 1) * pageSize;
  const filteredEndIndex = filteredStartIndex + pageSize;
  const paginatedFilteredExpenses = filteredExpenses.slice(filteredStartIndex, filteredEndIndex);

  // Clamp current page when data changes to prevent landing on empty pages
  useEffect(() => {
    if (filteredTotalPages > 0 && currentPage > filteredTotalPages) {
      setCurrentPage(Math.max(filteredTotalPages, 1));
    }
  }, [filteredTotalPages, currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, categoryFilter, amountFilter, paymentFilter, customDateFrom, customDateTo]);

  // Calculate analytics for filtered data
  const categoryStats = filteredExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + parseFloat(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

  const highestExpenses = [...filteredExpenses]
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
    .slice(0, 5);

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

  // Delete all expenses mutation
  const deleteAllExpensesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/expenses");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setShowDeleteAllDialog(false);
      setCurrentPage(1); // Reset to first page
      toast({
        title: "Success",
        description: "All expenses deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete all expenses.",
        variant: "destructive",
      });
    },
  });

  // Import expenses mutation with batch processing and progress tracking
  const importExpensesMutation = useMutation({
    mutationFn: async () => {
      setIsImporting(true);
      setImportProgress(0);
      
      const BATCH_SIZE = 10; // Process 10 expenses at a time
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      const totalBatches = Math.ceil(importData.length / BATCH_SIZE);

      // Process in batches
      for (let i = 0; i < importData.length; i += BATCH_SIZE) {
        const batch = importData.slice(i, i + BATCH_SIZE);
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
        
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

        // Update progress
        const progress = (currentBatch / totalBatches) * 100;
        setImportProgress(Math.round(progress));

        // Small delay between batches to prevent overwhelming the server
        if (i + BATCH_SIZE < importData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return { successCount, errorCount, totalCount: importData.length };
    },
    onSuccess: (result) => {
      setImportProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      
      // Small delay to show 100% completion before closing
      setTimeout(() => {
        setIsImporting(false);
        setImportModal(false);
        setImportData([]);
        setImportErrors([]);
        setImportProgress(0);
      }, 1500);
      
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
      setIsImporting(false);
      setImportProgress(0);
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
        
        const requiredHeaders = ["Date", "Person/Item", "Category", "Amount"];
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

            // Validate only essential required fields (allow blanks for others)
            if (!row.Date || !row["Person/Item"] || !row.Category || !row.Amount) {
              errors.push(`Row ${index + 2}: Missing essential data (Date, Person/Item, Category, Amount are required)`);
            }

            // Validate date format only if not blank
            if (row.Date && row.Date.trim() && isNaN(Date.parse(row.Date))) {
              errors.push(`Row ${index + 2}: Invalid date format`);
            }

            // Validate amount is numeric only if not blank
            if (row.Amount && row.Amount.trim() && isNaN(parseFloat(row.Amount))) {
              errors.push(`Row ${index + 2}: Amount must be a number`);
            }

            // Set default values for optional fields if blank
            if (!row.Qty || !row.Qty.trim()) {
              row.Qty = "1";
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

  // Calculate total amounts from filtered data
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  const totalDueAmount = filteredExpenses.reduce((sum, expense) => sum + parseFloat(expense.dueAmount || "0"), 0);

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
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <PermissionGuard permission="export:expenses">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={filteredExpenses.length === 0}
              data-testid="button-export-expenses"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </PermissionGuard>
          <Button
            variant="outline"
            onClick={handleExampleExport}
            data-testid="button-example-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Example CSV
          </Button>
          <PermissionGuard permission="create:expenses">
            <Button
              variant="outline"
              onClick={() => document.getElementById("import-input")?.click()}
              data-testid="button-import-expenses"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="create:expenses">
            <Button
              onClick={() => setShowAddForm(true)}
              data-testid="button-add-expense"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <input
        id="import-input"
        type="file"
        accept=".csv"
        onChange={handleImport}
        style={{ display: "none" }}
      />

      {/* Filters Section */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Analytics
            </CardTitle>
            <CardDescription>
              Filter expenses by date, category, amount, and payment status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Filter */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                {dateFilter === "custom" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        placeholder="From"
                        data-testid="input-custom-date-from"
                      />
                      <Input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        placeholder="To"
                        data-testid="input-custom-date-to"
                      />
                    </div>
                    {(!customDateFrom || !customDateTo) && (
                      <p className="text-xs text-muted-foreground">
                        Please select both start and end dates to apply custom date filter
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger data-testid="select-category-filter">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {expenseCategories.filter(category => category.isActive === "true").map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Filter */}
              <div className="space-y-2">
                <Label>Amount Range</Label>
                <Select value={amountFilter} onValueChange={setAmountFilter}>
                  <SelectTrigger data-testid="select-amount-filter">
                    <SelectValue placeholder="Select amount range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Amounts</SelectItem>
                    <SelectItem value="low">Low (&lt; TK 100)</SelectItem>
                    <SelectItem value="medium">Medium (TK 100-999)</SelectItem>
                    <SelectItem value="high">High (≥ TK 1000)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Status Filter */}
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger data-testid="select-payment-filter">
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="paid">Fully Paid</SelectItem>
                    <SelectItem value="partial">Partially Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-start">
              <Button
                variant="outline"
                onClick={() => {
                  setDateFilter("all");
                  setCategoryFilter("all");
                  setAmountFilter("all");
                  setPaymentFilter("all");
                  setCustomDateFrom("");
                  setCustomDateTo("");
                }}
                data-testid="button-clear-filters"
              >
                Clear All Filters
              </Button>
            </div>

            {/* Analytics Section */}
            {filteredExpenses.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Quick Analytics
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Categories */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Top 10 Categories
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {topCategories.map(([category, amount], index) => (
                        <div key={category} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">
                            {index + 1}. {category}
                          </span>
                          <span className="font-medium text-sm">TK {amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {topCategories.length === 0 && (
                        <p className="text-muted-foreground text-sm">No data available</p>
                      )}
                    </div>
                  </div>

                  {/* Highest Expenses */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Top 5 Highest Expenses
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {highestExpenses.map((expense, index) => (
                        <div key={expense.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="text-sm">
                            <div className="font-medium">{expense.personItem}</div>
                            <div className="text-muted-foreground">{expense.category}</div>
                          </div>
                          <span className="font-medium text-sm">TK {expense.amount}</span>
                        </div>
                      ))}
                      {highestExpenses.length === 0 && (
                        <p className="text-muted-foreground text-sm">No data available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              {filteredExpenses.length} expenses
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
                              {expenseCategories.filter(category => category.isActive === "true").map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
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
      <PermissionGuard 
        permission="view:expenses"
        fallback={
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                  <div className="text-yellow-800 dark:text-yellow-200">
                    <h3 className="font-medium mb-2">Access Restricted</h3>
                    <p>You don't have permission to view expenses. Please contact your administrator if you need access.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        }
      >
        <Card>
          <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>
                {expensesLoading ? "Loading..." : `${filteredExpenses.length} expense(s) found${filteredExpenses.length !== expenses.length ? ` (filtered from ${expenses.length})` : ""}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span>Show:</span>
                <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                  <SelectTrigger className="w-20" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
              <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={expenses.length === 0 || deleteAllExpensesMutation.isPending}
                    data-testid="button-delete-all"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Delete All Expenses
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete all {expenses.length} expenses? This action cannot be undone and will permanently remove all expense records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete-all">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAllExpensesMutation.mutate()}
                      disabled={deleteAllExpensesMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      data-testid="button-confirm-delete-all"
                    >
                      {deleteAllExpensesMutation.isPending ? "Deleting..." : "Delete All"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
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
                ) : filteredExpenses.length === 0 && expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No expenses found. Add your first expense to get started.
                    </TableCell>
                  </TableRow>
                ) : paginatedFilteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      {filteredExpenses.length === 0 ? (
                        "No expenses match the current filters. Try adjusting your filter criteria."
                      ) : (
                        <>
                          No expenses on this page. 
                          <Button 
                            variant="link" 
                            onClick={() => setCurrentPage(1)} 
                            className="ml-1 p-0 h-auto"
                            data-testid="button-go-to-first-page"
                          >
                            Go to first page
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedFilteredExpenses.map((expense) => (
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
          
          {/* Pagination Controls */}
          {filteredExpenses.length > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {filteredStartIndex + 1} to {Math.min(filteredEndIndex, totalFilteredExpenses)} of {totalFilteredExpenses} expenses
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  data-testid="button-previous-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">Page</span>
                  <span className="text-sm font-medium">{currentPage}</span>
                  <span className="text-sm">of</span>
                  <span className="text-sm font-medium">{filteredTotalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === filteredTotalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </PermissionGuard>

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

            {/* Progress Bar */}
            {isImporting && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-blue-800 dark:text-blue-200">Importing Expenses</CardTitle>
                  <CardDescription className="text-blue-700 dark:text-blue-300">
                    Processing {importData.length} expenses in batches...
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-blue-700 dark:text-blue-300">
                      <span>Progress</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress 
                      value={importProgress} 
                      className="w-full" 
                      data-testid="progress-import"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            
            {importData.length > 0 && !isImporting && (
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
                    disabled={importData.length === 0 || importExpensesMutation.isPending || importErrors.length > 0 || isImporting}
                    data-testid="button-confirm-import"
                  >
                    {isImporting ? `Importing... ${importProgress}%` : `Import ${importData.length} Expenses`}
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