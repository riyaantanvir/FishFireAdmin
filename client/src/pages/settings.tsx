import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type ItemType, type ExpenseCategory, insertItemTypeSchema, insertExpenseCategorySchema } from "@shared/schema";
import { z } from "zod";

type ItemTypeFormData = z.infer<typeof insertItemTypeSchema>;
type ExpenseCategoryFormData = z.infer<typeof insertExpenseCategorySchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const [isItemTypeDialogOpen, setIsItemTypeDialogOpen] = useState(false);
  const [isExpenseCategoryDialogOpen, setIsExpenseCategoryDialogOpen] = useState(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [editingExpenseCategory, setEditingExpenseCategory] = useState<ExpenseCategory | null>(null);

  // Item Types Query
  const { data: itemTypes = [], isLoading: itemTypesLoading } = useQuery<ItemType[]>({
    queryKey: ["/api/item-types"],
  });

  // Expense Categories Query  
  const { data: expenseCategories = [], isLoading: expenseCategoriesLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  // Item Type Form
  const itemTypeForm = useForm<ItemTypeFormData>({
    resolver: zodResolver(insertItemTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: "true",
    },
  });

  // Expense Category Form
  const expenseCategoryForm = useForm<ExpenseCategoryFormData>({
    resolver: zodResolver(insertExpenseCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: "true",
    },
  });

  // Item Type Mutations
  const createItemTypeMutation = useMutation({
    mutationFn: (data: ItemTypeFormData) => 
      apiRequest("POST", "/api/item-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/item-types"] });
      toast({ title: "Success", description: "Item type created successfully" });
      setIsItemTypeDialogOpen(false);
      itemTypeForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create item type", variant: "destructive" });
    },
  });

  const updateItemTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ItemTypeFormData }) =>
      apiRequest("PUT", `/api/item-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/item-types"] });
      toast({ title: "Success", description: "Item type updated successfully" });
      setIsItemTypeDialogOpen(false);
      setEditingItemType(null);
      itemTypeForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update item type", variant: "destructive" });
    },
  });

  const deleteItemTypeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/item-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/item-types"] });
      toast({ title: "Success", description: "Item type deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete item type", variant: "destructive" });
    },
  });

  // Expense Category Mutations
  const createExpenseCategoryMutation = useMutation({
    mutationFn: (data: ExpenseCategoryFormData) => 
      apiRequest("POST", "/api/expense-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({ title: "Success", description: "Expense category created successfully" });
      setIsExpenseCategoryDialogOpen(false);
      expenseCategoryForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create expense category", variant: "destructive" });
    },
  });

  const updateExpenseCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseCategoryFormData }) =>
      apiRequest("PUT", `/api/expense-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({ title: "Success", description: "Expense category updated successfully" });
      setIsExpenseCategoryDialogOpen(false);
      setEditingExpenseCategory(null);
      expenseCategoryForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update expense category", variant: "destructive" });
    },
  });

  const deleteExpenseCategoryMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/expense-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      toast({ title: "Success", description: "Expense category deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete expense category", variant: "destructive" });
    },
  });

  // Form Submit Handlers
  const onItemTypeSubmit = (data: ItemTypeFormData) => {
    if (editingItemType) {
      updateItemTypeMutation.mutate({ id: editingItemType.id, data });
    } else {
      createItemTypeMutation.mutate(data);
    }
  };

  const onExpenseCategorySubmit = (data: ExpenseCategoryFormData) => {
    if (editingExpenseCategory) {
      updateExpenseCategoryMutation.mutate({ id: editingExpenseCategory.id, data });
    } else {
      createExpenseCategoryMutation.mutate(data);
    }
  };

  // Edit Handlers
  const handleEditItemType = (itemType: ItemType) => {
    setEditingItemType(itemType);
    itemTypeForm.reset({
      name: itemType.name,
      description: itemType.description || "",
      isActive: itemType.isActive,
    });
    setIsItemTypeDialogOpen(true);
  };

  const handleEditExpenseCategory = (category: ExpenseCategory) => {
    setEditingExpenseCategory(category);
    expenseCategoryForm.reset({
      name: category.name,
      description: category.description || "",
      isActive: category.isActive,
    });
    setIsExpenseCategoryDialogOpen(true);
  };

  // Reset Forms when closing dialogs
  const handleItemTypeDialogClose = () => {
    setIsItemTypeDialogOpen(false);
    setEditingItemType(null);
    itemTypeForm.reset();
  };

  const handleExpenseCategoryDialogClose = () => {
    setIsExpenseCategoryDialogOpen(false);
    setEditingExpenseCategory(null);
    expenseCategoryForm.reset();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your system configurations and master data
          </p>
        </div>

        <div className="grid gap-6">
          {/* Item Types Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Item Types</CardTitle>
                <CardDescription>
                  Manage categories for your inventory items
                </CardDescription>
              </div>
              <PermissionGuard permission="create:items">
                <Dialog open={isItemTypeDialogOpen} onOpenChange={setIsItemTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-item-type">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item Type
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItemType ? "Edit Item Type" : "Add New Item Type"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingItemType 
                        ? "Update the item type information." 
                        : "Create a new item type for your inventory items."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...itemTypeForm}>
                    <form onSubmit={itemTypeForm.handleSubmit(onItemTypeSubmit)} className="space-y-4">
                      <FormField
                        control={itemTypeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Enter item type name"
                                data-testid="input-item-type-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemTypeForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field}
                                value={field.value || ""}
                                placeholder="Enter item type description"
                                data-testid="input-item-type-description"
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={itemTypeForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-item-type-status">
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
                          type="button" 
                          variant="outline" 
                          onClick={handleItemTypeDialogClose}
                          data-testid="button-cancel-item-type"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createItemTypeMutation.isPending || updateItemTypeMutation.isPending}
                          data-testid="button-save-item-type"
                        >
                          {createItemTypeMutation.isPending || updateItemTypeMutation.isPending 
                            ? "Saving..." 
                            : editingItemType ? "Update" : "Create"
                          }
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              </PermissionGuard>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemTypesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          Loading item types...
                        </TableCell>
                      </TableRow>
                    ) : itemTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No item types found. Add your first item type to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      itemTypes.map((itemType) => (
                        <TableRow key={itemType.id} data-testid={`row-item-type-${itemType.id}`}>
                          <TableCell className="font-medium" data-testid={`text-item-type-name-${itemType.id}`}>
                            {itemType.name}
                          </TableCell>
                          <TableCell data-testid={`text-item-type-description-${itemType.id}`}>
                            {itemType.description || "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                itemType.isActive === "true"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                              data-testid={`status-item-type-${itemType.id}`}
                            >
                              {itemType.isActive === "true" ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditItemType(itemType)}
                                data-testid={`button-edit-item-type-${itemType.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteItemTypeMutation.mutate(itemType.id)}
                                disabled={deleteItemTypeMutation.isPending}
                                data-testid={`button-delete-item-type-${itemType.id}`}
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

          {/* Expense Categories Management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>
                  Manage categories for your business expenses
                </CardDescription>
              </div>
              <Dialog open={isExpenseCategoryDialogOpen} onOpenChange={setIsExpenseCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-expense-category">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingExpenseCategory ? "Edit Expense Category" : "Add New Expense Category"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingExpenseCategory 
                        ? "Update the expense category information." 
                        : "Create a new category for your business expenses."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...expenseCategoryForm}>
                    <form onSubmit={expenseCategoryForm.handleSubmit(onExpenseCategorySubmit)} className="space-y-4">
                      <FormField
                        control={expenseCategoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Enter category name"
                                data-testid="input-expense-category-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={expenseCategoryForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field}
                                value={field.value || ""}
                                placeholder="Enter category description"
                                data-testid="input-expense-category-description"
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={expenseCategoryForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-expense-category-status">
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
                          type="button" 
                          variant="outline" 
                          onClick={handleExpenseCategoryDialogClose}
                          data-testid="button-cancel-expense-category"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createExpenseCategoryMutation.isPending || updateExpenseCategoryMutation.isPending}
                          data-testid="button-save-expense-category"
                        >
                          {createExpenseCategoryMutation.isPending || updateExpenseCategoryMutation.isPending 
                            ? "Saving..." 
                            : editingExpenseCategory ? "Update" : "Create"
                          }
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseCategoriesLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          Loading expense categories...
                        </TableCell>
                      </TableRow>
                    ) : expenseCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No expense categories found. Add your first category to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenseCategories.map((category) => (
                        <TableRow key={category.id} data-testid={`row-expense-category-${category.id}`}>
                          <TableCell className="font-medium" data-testid={`text-expense-category-name-${category.id}`}>
                            {category.name}
                          </TableCell>
                          <TableCell data-testid={`text-expense-category-description-${category.id}`}>
                            {category.description || "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                category.isActive === "true"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                              data-testid={`status-expense-category-${category.id}`}
                            >
                              {category.isActive === "true" ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditExpenseCategory(category)}
                                data-testid={`button-edit-expense-category-${category.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteExpenseCategoryMutation.mutate(category.id)}
                                disabled={deleteExpenseCategoryMutation.isPending}
                                data-testid={`button-delete-expense-category-${category.id}`}
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
        </div>
      </div>
    </div>
  );
}