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
import { Search, Edit, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@shared/schema";
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
  itemType: z.enum(["Fish", "Non-Fish", "Drinks", "Other"], {
    required_error: "Please select an item type",
  }),
  sellingPricePerKG: z.number().min(0, "Price must be positive").optional(),
  sellingPricePerPCS: z.number().min(0, "Price must be positive").optional(),
}).refine(
  (data) => data.sellingPricePerKG || data.sellingPricePerPCS,
  {
    message: "At least one selling price (per KG or per PCS) must be provided",
    path: ["sellingPricePerKG"],
  }
);

type ItemForm = z.infer<typeof itemFormSchema>;

export default function ItemManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
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
        sellingPricePerKG: data.sellingPricePerKG?.toString() || null,
        sellingPricePerPCS: data.sellingPricePerPCS?.toString() || null,
        // Legacy fields for compatibility
        description: `${data.itemType} item`,
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
        sellingPricePerKG: data.sellingPricePerKG?.toString() || null,
        sellingPricePerPCS: data.sellingPricePerPCS?.toString() || null,
        // Update legacy fields for compatibility
        description: `${data.itemType} item`,
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
  };

  const onEditSubmit = (values: ItemForm) => {
    if (editingItem) {
      updateItemMutation.mutate({ itemId: editingItem.id, data: values });
    }
  };

  // Check if item is sold per KG or PCS
  const isSoldPerKG = (item: Item) => {
    return item.sellingPricePerKG && parseFloat(item.sellingPricePerKG) > 0;
  };

  const isSoldPerPCS = (item: Item) => {
    return item.sellingPricePerPCS && parseFloat(item.sellingPricePerPCS) > 0;
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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Item Management</h2>
        <p className="text-muted-foreground">Manage inventory items with flexible pricing</p>
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
                          <SelectItem value="Fish">Fish</SelectItem>
                          <SelectItem value="Non-Fish">Non-Fish</SelectItem>
                          <SelectItem value="Drinks">Drinks</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              <Button 
                type="submit" 
                className="w-full"
                disabled={createItemMutation.isPending}
                data-testid="button-save-item"
              >
                Save Item
              </Button>
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
                <SelectItem value="Fish">Fish</SelectItem>
                <SelectItem value="Non-Fish">Non-Fish</SelectItem>
                <SelectItem value="Drinks">Drinks</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
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
                  <TableHead>Selling Price per KG</TableHead>
                  <TableHead>Selling Price per PCS</TableHead>
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
                      {isSoldPerKG(item) ? (
                        <span className="font-medium">${item.sellingPricePerKG}</span>
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {isSoldPerPCS(item) ? (
                        <span className="font-medium">${item.sellingPricePerPCS}</span>
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-item-${item.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          disabled={deleteItemMutation.isPending}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update item information and pricing
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit(onEditSubmit)} 
                className="space-y-4"
                key={editingItem.id} // Force re-render when editing different item
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            {...field}
                            defaultValue={editingItem.date || new Date().toISOString().split('T')[0]}
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
                            {...field}
                            defaultValue={editingItem.name}
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
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={editingItem.itemType || editingItem.category}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Fish">Fish</SelectItem>
                            <SelectItem value="Non-Fish">Non-Fish</SelectItem>
                            <SelectItem value="Drinks">Drinks</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            defaultValue={editingItem.sellingPricePerKG ? parseFloat(editingItem.sellingPricePerKG) : ""}
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
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            defaultValue={editingItem.sellingPricePerPCS ? parseFloat(editingItem.sellingPricePerPCS) : ""}
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
                    onClick={() => setEditingItem(null)}
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