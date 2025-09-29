import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Edit, Trash2, X, Download, Upload, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";
import type { Item, ItemType } from "@shared/schema";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Item form schema for new structure
const itemFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Item name is required"),
  itemType: z.string().min(1, "Please select an item type"),
  itemSaleType: z.enum(["Per KG", "Per PCS"], {
    required_error: "Please select a sale type",
  }),
  weightPerPCS: z.number().min(0.001, "Weight per PCS must be positive").optional(),
  sellingPricePerKG: z.number().min(0, "Price must be positive").optional(),
  sellingPricePerPCS: z.number().min(0, "Price must be positive").optional(),
}).refine(
  (data) => {
    if (data.itemSaleType === "Per PCS") {
      return data.weightPerPCS && data.sellingPricePerKG;
    }
    return data.sellingPricePerKG || data.sellingPricePerPCS;
  },
  {
    message: "For Per PCS items, provide Weight per PCS and Selling Price per KG. For Per KG items, provide at least one selling price.",
    path: ["sellingPricePerKG"],
  }
);

type ItemForm = z.infer<typeof itemFormSchema>;

export default function ItemManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissions();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
    enabled: canView("items"), // Only fetch if user can view items
  });

  const { data: itemTypes = [] } = useQuery<ItemType[]>({
    queryKey: ["/api/item-types"],
  });

  // Get next item number
  const getNextItemNumber = () => {
    if (items.length === 0) return 1;
    const maxItemNumber = Math.max(...items.map(item => item.itemNumber || 0));
    return maxItemNumber + 1;
  };

  const form = useForm<ItemForm>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      name: "",
      itemType: undefined,
      itemSaleType: undefined,
      weightPerPCS: undefined,
      sellingPricePerKG: undefined,
      sellingPricePerPCS: undefined,
    },
  });

  const editForm = useForm<ItemForm>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      name: "",
      itemType: undefined,
      itemSaleType: undefined,
      weightPerPCS: undefined,
      sellingPricePerKG: undefined,
      sellingPricePerPCS: undefined,
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: ItemForm) => {
      const itemData = {
        itemNumber: getNextItemNumber(),
        date: data.date,
        name: data.name,
        itemType: data.itemType,
        itemSaleType: data.itemSaleType,
        weightPerPCS: data.weightPerPCS?.toString() || null,
        sellingPricePerKG: data.sellingPricePerKG?.toString() || null,
        sellingPricePerPCS: data.sellingPricePerPCS?.toString() || null,
        // Legacy fields for compatibility
        description: `${data.itemType} item - ${data.itemSaleType}`,
        price: (data.sellingPricePerKG || data.sellingPricePerPCS || 0).toString(),
        stock: 0,
        category: data.itemType,
        isActive: "true",
      };

      const response = await apiRequest("POST", "/api/items", itemData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      form.reset({
        date: new Date().toISOString().split('T')[0],
        name: "",
        itemType: undefined,
        itemSaleType: undefined,
        weightPerPCS: undefined,
        sellingPricePerKG: undefined,
        sellingPricePerPCS: undefined,
      });
      toast({
        title: "Success",
        description: "Item created successfully",
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

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: ItemForm }) => {
      const itemData = {
        date: data.date,
        name: data.name,
        itemType: data.itemType,
        itemSaleType: data.itemSaleType,
        weightPerPCS: data.weightPerPCS?.toString() || null,
        sellingPricePerKG: data.sellingPricePerKG?.toString() || null,
        sellingPricePerPCS: data.sellingPricePerPCS?.toString() || null,
        // Update legacy fields for compatibility
        description: `${data.itemType} item - ${data.itemSaleType}`,
        price: (data.sellingPricePerKG || data.sellingPricePerPCS || 0).toString(),
        category: data.itemType,
      };

      const response = await apiRequest("PUT", `/api/items/${itemId}`, itemData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setEditingItem(null);
      toast({
        title: "Success",
        description: "Item updated successfully",
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

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Success",
        description: "Item deleted successfully",
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

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || item.itemType === typeFilter;
    return matchesSearch && matchesType;
  });

  const onSubmit = (values: ItemForm) => {
    createItemMutation.mutate(values);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    // Reset the edit form with the selected item's data
    editForm.reset({
      date: item.date || new Date().toISOString().split('T')[0],
      name: item.name,
      itemType: (item.itemType || item.category) as "Fish" | "Non-Fish" | "Drinks" | "Other",
      itemSaleType: (item.itemSaleType || "Per KG") as "Per KG" | "Per PCS",
      weightPerPCS: item.weightPerPCS ? parseFloat(item.weightPerPCS) : undefined,
      sellingPricePerKG: item.sellingPricePerKG ? parseFloat(item.sellingPricePerKG) : undefined,
      sellingPricePerPCS: item.sellingPricePerPCS ? parseFloat(item.sellingPricePerPCS) : undefined,
    });
  };

  const onEditSubmit = (values: ItemForm) => {
    if (editingItem) {
      updateItemMutation.mutate({ itemId: editingItem.id, data: values });
    }
  };

  const handleCloseEditModal = (open: boolean) => {
    if (!open) {
      setEditingItem(null);
      editForm.reset();
    }
  };

  // Check if item is sold per KG or PCS
  const isSoldPerKG = (item: Item) => {
    return item.sellingPricePerKG && parseFloat(item.sellingPricePerKG) > 0;
  };

  const isSoldPerPCS = (item: Item) => {
    return item.sellingPricePerPCS && parseFloat(item.sellingPricePerPCS) > 0;
  };

  // CSV parser that handles quoted fields properly
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Handle escaped quotes ("")
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator found outside quotes (don't trim to preserve intentional whitespace)
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field (don't trim to preserve intentional whitespace)
    result.push(current);
    
    return result;
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

  // CSV Template Download
  const downloadTemplate = () => {
    const headers = [
      'date',
      'name', 
      'itemType',
      'itemSaleType',
      'weightPerPCS',
      'sellingPricePerKG',
      'sellingPricePerPCS',
      'description',
      'stock',
      'category',
      'isActive'
    ];

    const exampleRows = [
      [
        '2025-09-28',
        'Hilsha Fish',
        'Fish',
        'Per PCS',
        '0.8',
        '500',
        '',
        'Fresh Hilsha fish',
        '10',
        'Fish',
        'true'
      ],
      [
        '2025-09-28',
        'Salmon',
        'Fish', 
        'Per KG',
        '',
        '800',
        '640',
        'Fresh salmon',
        '5',
        'Fish',
        'true'
      ]
    ];

    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.map(cell => escapeCSVField(cell)).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'items_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: "Success",
      description: "Template downloaded successfully",
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    if (items.length === 0) {
      toast({
        title: "No data to export",
        description: "Please add some items first",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'date',
      'name',
      'itemType', 
      'itemSaleType',
      'weightPerPCS',
      'sellingPricePerKG',
      'sellingPricePerPCS',
      'description',
      'stock',
      'category',
      'isActive'
    ];

    const csvRows = items.map(item => [
      item.date || '',
      item.name || '',
      item.itemType || item.category || '',
      item.itemSaleType || 'Per KG',
      item.weightPerPCS || '',
      item.sellingPricePerKG || '',
      item.sellingPricePerPCS || '',
      item.description || '',
      item.stock?.toString() || '0',
      item.category || '',
      item.isActive || 'true'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => escapeCSVField(cell)).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `items_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast({
      title: "Success", 
      description: `Exported ${items.length} items successfully`,
    });
  };

  // CSV Import Handler
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast({
            title: "Invalid CSV",
            description: "CSV file must contain headers and at least one data row",
            variant: "destructive",
          });
          return;
        }

        const headers = parseCSVLine(lines[0]);
        const expectedHeaders = ['date', 'name', 'itemType', 'itemSaleType', 'weightPerPCS', 'sellingPricePerKG', 'sellingPricePerPCS', 'description', 'stock', 'category', 'isActive'];
        
        // Check if basic required headers exist
        const requiredHeaders = ['name', 'itemType', 'itemSaleType'];
        const missingRequired = requiredHeaders.filter(header => !headers.includes(header));
        
        if (missingRequired.length > 0) {
          toast({
            title: "Invalid CSV format",
            description: `Missing required headers: ${missingRequired.join(', ')}`,
            variant: "destructive",
          });
          return;
        }

        const itemsToImport = [];
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);
            const itemData: any = {};

            headers.forEach((header, index) => {
              itemData[header] = values[index] || '';
            });

            // Validate required fields
            if (!itemData.name || !itemData.itemType || !itemData.itemSaleType) {
              errorCount++;
              continue;
            }

            // Prepare item for API (keep values as strings to match API expectations)
            const newItem: any = {
              itemNumber: getNextItemNumber() + itemsToImport.length,
              date: itemData.date || new Date().toISOString().split('T')[0],
              name: itemData.name,
              itemType: itemData.itemType,
              itemSaleType: itemData.itemSaleType,
              weightPerPCS: itemData.weightPerPCS || undefined,
              sellingPricePerKG: itemData.sellingPricePerKG || undefined,
              sellingPricePerPCS: itemData.sellingPricePerPCS || undefined,
              description: itemData.description || '',
              price: itemData.sellingPricePerKG || itemData.sellingPricePerPCS || '0',
              stock: parseInt(itemData.stock) || 0,
              category: itemData.category || itemData.itemType,
              isActive: itemData.isActive || 'true',
            };

            itemsToImport.push(newItem);
          } catch (error) {
            errorCount++;
          }
        }

        if (itemsToImport.length === 0) {
          toast({
            title: "No valid items found",
            description: "Please check your CSV format and try again",
            variant: "destructive",
          });
          return;
        }

        // Import items one by one
        let successCount = 0;
        for (const item of itemsToImport) {
          try {
            await apiRequest("POST", "/api/items", item);
            successCount++;
          } catch (error) {
            errorCount++;
          }
        }

        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
        
        toast({
          title: "Import completed",
          description: `Successfully imported ${successCount} items${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
        });

      } catch (error) {
        toast({
          title: "Import failed",
          description: "Error processing CSV file",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    // Reset the input
    event.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Item Management</h2>
          <p className="text-muted-foreground">Manage inventory items with flexible pricing</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            data-testid="button-download-template"
          >
            <FileText className="h-4 w-4 mr-2" />
            Template
          </Button>
          <PermissionGuard permission="create:items">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('csv-import')?.click()}
              data-testid="button-import-csv"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="export:items">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </PermissionGuard>
          <input
            id="csv-import"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
        </div>
      </div>

      {/* Create New Item Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Item</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date */}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          data-testid="input-item-date"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Item Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter item name"
                          data-testid="input-item-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Item Type */}
                <FormField
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {itemTypes.filter(type => type.isActive === "true").map((type) => (
                            <SelectItem key={type.id} value={type.name}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Item Sale Type */}
                <FormField
                  control={form.control}
                  name="itemSaleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Sale Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-sale-type">
                            <SelectValue placeholder="Select sale type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Per KG">Per KG</SelectItem>
                          <SelectItem value="Per PCS">Per PCS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Weight per PCS (only show when Per PCS is selected) */}
                {form.watch("itemSaleType") === "Per PCS" && (
                  <FormField
                    control={form.control}
                    name="weightPerPCS"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight per PCS (KG)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.001"
                            min="0"
                            placeholder="0.000"
                            data-testid="input-weight-per-pcs"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Selling Price per KG */}
                <FormField
                  control={form.control}
                  name="sellingPricePerKG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price per KG</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          data-testid="input-price-kg"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Selling Price per PCS */}
                <FormField
                  control={form.control}
                  name="sellingPricePerPCS"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price per PCS</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          data-testid="input-price-pcs"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <PermissionGuard 
                permission="create:items"
                fallback={
                  <div className="text-center text-muted-foreground p-4 border rounded-lg bg-muted/20">
                    You don't have permission to create items
                  </div>
                }
              >
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={createItemMutation.isPending}
                  data-testid="button-save-item"
                >
                  Save Item
                </Button>
              </PermissionGuard>
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
                placeholder="Search items by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-items"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40" data-testid="select-type-filter">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {itemTypes.filter(type => type.isActive === "true").map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {items.length === 0 ? (
                <div>
                  <p className="text-lg font-medium mb-2">No items yet</p>
                  <p>Create your first item using the form above.</p>
                </div>
              ) : (
                <p>No items match your search criteria.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item Number</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Item Type</TableHead>
                  <TableHead>Sale Type</TableHead>
                  <TableHead>Weight per PCS</TableHead>
                  <TableHead>Price per KG</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`item-row-${item.id}`}>
                    <TableCell>
                      {item.date ? new Date(item.date).toLocaleDateString() : 
                       item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">{item.itemNumber || 'N/A'}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.itemType || item.category}</TableCell>
                    <TableCell>
                      <span className="font-medium">{item.itemSaleType || 'Per KG'}</span>
                    </TableCell>
                    <TableCell>
                      {item.itemSaleType === "Per PCS" && item.weightPerPCS ? (
                        <span className="font-medium">{item.weightPerPCS} KG</span>
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.sellingPricePerKG ? (
                        <span className="font-medium">TK {item.sellingPricePerKG}</span>
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <PermissionGuard permission="edit:items">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-item-${item.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="delete:items">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                            disabled={deleteItemMutation.isPending}
                            data-testid={`button-delete-item-${item.id}`}
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

      {/* Edit Item Modal */}
      <Dialog open={!!editingItem} onOpenChange={handleCloseEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update item information and pricing
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <Form {...editForm}>
              <form 
                onSubmit={editForm.handleSubmit(onEditSubmit)} 
                className="space-y-4"
                key={editingItem.id} // Force re-render when editing different item
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date */}
                  <FormField
                    control={editForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Item Name */}
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter item name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Item Type */}
                  <FormField
                    control={editForm.control}
                    name="itemType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {itemTypes.filter(type => type.isActive === "true").map((type) => (
                              <SelectItem key={type.id} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Item Sale Type */}
                  <FormField
                    control={editForm.control}
                    name="itemSaleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Sale Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sale type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Per KG">Per KG</SelectItem>
                            <SelectItem value="Per PCS">Per PCS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Weight per PCS (only show when Per PCS is selected) */}
                  {editForm.watch("itemSaleType") === "Per PCS" && (
                    <FormField
                      control={editForm.control}
                      name="weightPerPCS"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight per PCS (KG)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="0.000"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Selling Price per KG */}
                  <FormField
                    control={editForm.control}
                    name="sellingPricePerKG"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price per KG</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Selling Price per PCS */}
                  <FormField
                    control={editForm.control}
                    name="sellingPricePerPCS"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price per PCS</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleCloseEditModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={updateItemMutation.isPending}
                  >
                    Update Item
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}