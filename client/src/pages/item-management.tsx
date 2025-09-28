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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertItemSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Item } from "@shared/schema";
import { z } from "zod";

const itemFormSchema = insertItemSchema;

export default function ItemManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof itemFormSchema>) => {
      const response = await apiRequest("POST", "/api/items", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setIsCreateDialogOpen(false);
      form.reset();
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
    mutationFn: async ({ itemId, data }: { itemId: string; data: Partial<Item> }) => {
      const response = await apiRequest("PUT", `/api/items/${itemId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setEditingItem(null);
      editForm.reset();
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

  const form = useForm<z.infer<typeof itemFormSchema>>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      stock: 0,
      category: "",
      isActive: "true",
    },
  });

  const editForm = useForm<z.infer<typeof itemFormSchema>>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      stock: 0,
      category: "",
      isActive: "true",
    },
  });

  const categories = Array.from(new Set(items.map(item => item.category))).filter(Boolean);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const onSubmit = (values: z.infer<typeof itemFormSchema>) => {
    createItemMutation.mutate(values);
  };

  const onEditSubmit = (values: z.infer<typeof itemFormSchema>) => {
    if (editingItem) {
      updateItemMutation.mutate({
        itemId: editingItem.id,
        data: values,
      });
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    editForm.reset({
      name: item.name,
      description: item.description || "",
      price: item.price,
      stock: item.stock,
      category: item.category,
      isActive: item.isActive,
    });
  };

  const getStockStatus = (stock: number) => {
    if (stock <= 3) return { variant: "destructive" as const, label: "Critical" };
    if (stock <= 10) return { variant: "secondary" as const, label: "Low" };
    return { variant: "default" as const, label: "Good" };
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Item Management</h2>
          <p className="text-muted-foreground">Manage your inventory and product catalog</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-item">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>
                Add a new item to your inventory.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
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
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter item description"
                          data-testid="input-item-description"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            data-testid="input-item-price"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="0"
                            data-testid="input-item-stock"
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Fresh Fish, Shellfish"
                          data-testid="input-item-category"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-item-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Active</SelectItem>
                          <SelectItem value="false">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createItemMutation.isPending}
                    data-testid="button-submit-item"
                  >
                    Add Item
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Items</p>
                <p className="text-2xl font-bold" data-testid="stat-total-items">{items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Active Items</p>
                <p className="text-2xl font-bold" data-testid="stat-active-items">
                  {items.filter(item => item.isActive === "true").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium">Low Stock</p>
                <p className="text-2xl font-bold" data-testid="stat-low-stock">
                  {items.filter(item => item.stock <= 10).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Categories</p>
                <p className="text-2xl font-bold" data-testid="stat-categories">{categories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search items by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-items"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
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
                  <p>Add your first item to get started.</p>
                </div>
              ) : (
                <p>No items match your search criteria.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const stockStatus = getStockStatus(item.stock);
                  return (
                    <TableRow key={item.id} data-testid={`item-row-${item.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>${item.price}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{item.stock}</span>
                          <Badge variant={stockStatus.variant} className="text-xs">
                            {stockStatus.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive === "true" ? "default" : "secondary"}>
                          {item.isActive === "true" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update the item information.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter item name"
                        data-testid="input-edit-item-name"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter item description"
                        data-testid="input-edit-item-description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-edit-item-price"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          placeholder="0"
                          data-testid="input-edit-item-stock"
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Fresh Fish, Shellfish"
                        data-testid="input-edit-item-category"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-item-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateItemMutation.isPending}
                  data-testid="button-submit-edit-item"
                >
                  Update Item
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
