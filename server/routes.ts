import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, authenticateJWT, requireRole, requirePermission, hashPassword } from "./auth";
import { storage } from "./storage";
import { insertOrderSchema, insertItemSchema, insertExpenseSchema, insertOpeningStockSchema, insertClosingStockSchema, insertPaymentSchema, insertItemTypeSchema, insertExpenseCategorySchema, insertUserSchema, insertRoleSchema, insertPermissionSchema, insertUserRoleSchema, insertRolePermissionSchema } from "@shared/schema";

// Helper function to sanitize user objects by removing sensitive fields
function sanitizeUser(user: any) {
  const { 
    password, 
    passwordHash, 
    resetToken, 
    resetTokenExpiry, 
    ...safeUser 
  } = user;
  return safeUser;
}

function sanitizeUsers(users: any[]) {
  return users.map(sanitizeUser);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Orders API
  app.get("/api/orders", authenticateJWT, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created order #${order.id} - ${order.itemName} (${order.quantity} ${order.unit})`,
          resource: 'order',
          resourceId: order.id,
          details: { orderData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for order creation:', auditError);
      }
      
      res.status(201).json(order);
    } catch (error) {
      console.error('Create order error:', error);
      res.status(400).json({ message: "Invalid order data" });
    }
  });

  app.put("/api/orders/:id", authenticateJWT, async (req, res) => {
    try {
      const order = await storage.updateOrder(req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated order #${order.id} - ${order.itemName}`,
          resource: 'order',
          resourceId: order.id,
          details: { updates: req.body }
        });
      } catch (auditError) {
        console.warn('Audit log failed for order update:', auditError);
      }
      
      res.json(order);
    } catch (error) {
      res.status(400).json({ message: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted order #${req.params.id}`,
          resource: 'order',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for order deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete order" });
    }
  });

  // Bulk delete all orders endpoint - admin only
  app.delete("/api/orders", authenticateJWT, async (req, res) => {
    try {
      // Check if user has admin role
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const deletedCount = await storage.clearAllOrders();
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Bulk deleted all orders (${deletedCount} orders)`,
          resource: 'order',
          details: { deletedCount }
        });
      } catch (auditError) {
        console.warn('Audit log failed for bulk order deletion:', auditError);
      }
      
      res.json({ message: `Deleted ${deletedCount} orders`, count: deletedCount });
    } catch (error) {
      console.error('Clear orders error:', error);
      res.status(500).json({ message: "Failed to delete orders" });
    }
  });

  // Items API
  app.get("/api/items", authenticateJWT, async (req, res) => {
    try {
      const items = await storage.getItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post("/api/items", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertItemSchema.parse(req.body);
      const item = await storage.createItem(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created item: ${item.name} (${item.unit})`,
          resource: 'item',
          resourceId: item.id,
          details: { itemData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for item creation:', auditError);
      }
      
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid item data" });
    }
  });

  app.put("/api/items/:id", authenticateJWT, async (req, res) => {
    try {
      const item = await storage.updateItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated item: ${item.name}`,
          resource: 'item',
          resourceId: item.id,
          details: { updates: req.body }
        });
      } catch (auditError) {
        console.warn('Audit log failed for item update:', auditError);
      }
      
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: "Failed to update item" });
    }
  });

  app.delete("/api/items/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteItem(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted item #${req.params.id}`,
          resource: 'item',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for item deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Expenses API
  app.get("/api/expenses", authenticateJWT, async (req, res) => {
    try {
      const expenses = await storage.getExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created expense: ${expense.category} - $${expense.amount} (${expense.description})`,
          resource: 'expense',
          resourceId: expense.id,
          details: { expenseData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for expense creation:', auditError);
      }
      
      res.status(201).json(expense);
    } catch (error) {
      res.status(400).json({ message: "Invalid expense data" });
    }
  });

  app.put("/api/expenses/:id", authenticateJWT, async (req, res) => {
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated expense: ${expense.category} - $${expense.amount}`,
          resource: 'expense',
          resourceId: expense.id,
          details: { updates: req.body }
        });
      } catch (auditError) {
        console.warn('Audit log failed for expense update:', auditError);
      }
      
      res.json(expense);
    } catch (error) {
      res.status(400).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted expense #${req.params.id}`,
          resource: 'expense',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for expense deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Delete all expenses
  app.delete("/api/expenses", authenticateJWT, async (req, res) => {
    try {
      await storage.deleteAllExpenses();
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: 'Bulk deleted all expenses',
          resource: 'expense'
        });
      } catch (auditError) {
        console.warn('Audit log failed for bulk expense deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete all expenses" });
    }
  });

  // Stock Reconciliation API - Opening Stock
  app.get("/api/opening-stock/:date", authenticateJWT, async (req, res) => {
    try {
      const openingStock = await storage.getOpeningStockByDate(req.params.date);
      res.json(openingStock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch opening stock" });
    }
  });

  app.post("/api/opening-stock", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertOpeningStockSchema.parse(req.body);
      const openingStock = await storage.createOpeningStock(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created opening stock: ${openingStock.itemName} - ${openingStock.quantity} ${openingStock.unit} (${openingStock.date})`,
          resource: 'opening_stock',
          resourceId: openingStock.id,
          details: { stockData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for opening stock creation:', auditError);
      }
      
      res.status(201).json(openingStock);
    } catch (error) {
      res.status(400).json({ message: "Invalid opening stock data" });
    }
  });

  app.put("/api/opening-stock/:id", authenticateJWT, async (req, res) => {
    try {
      const openingStock = await storage.updateOpeningStock(req.params.id, req.body);
      if (!openingStock) {
        return res.status(404).json({ message: "Opening stock entry not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated opening stock: ${openingStock.itemName} - ${openingStock.quantity} ${openingStock.unit}`,
          resource: 'opening_stock',
          resourceId: openingStock.id,
          details: { updates: req.body }
        });
      } catch (auditError) {
        console.warn('Audit log failed for opening stock update:', auditError);
      }
      
      res.json(openingStock);
    } catch (error) {
      res.status(400).json({ message: "Failed to update opening stock" });
    }
  });

  app.delete("/api/opening-stock/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteOpeningStock(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Opening stock entry not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted opening stock entry #${req.params.id}`,
          resource: 'opening_stock',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for opening stock deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete opening stock" });
    }
  });

  // Stock Reconciliation API - Closing Stock
  app.get("/api/closing-stock/:date", authenticateJWT, async (req, res) => {
    try {
      const closingStock = await storage.getClosingStockByDate(req.params.date);
      res.json(closingStock);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch closing stock" });
    }
  });

  app.post("/api/closing-stock", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertClosingStockSchema.parse(req.body);
      const closingStock = await storage.createClosingStock(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created closing stock: ${closingStock.itemName} - ${closingStock.quantity} ${closingStock.unit} (${closingStock.date})`,
          resource: 'closing_stock',
          resourceId: closingStock.id,
          details: { stockData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for closing stock creation:', auditError);
      }
      
      res.status(201).json(closingStock);
    } catch (error) {
      res.status(400).json({ message: "Invalid closing stock data" });
    }
  });

  app.put("/api/closing-stock/:id", authenticateJWT, async (req, res) => {
    try {
      const closingStock = await storage.updateClosingStock(req.params.id, req.body);
      if (!closingStock) {
        return res.status(404).json({ message: "Closing stock entry not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated closing stock: ${closingStock.itemName} - ${closingStock.quantity} ${closingStock.unit}`,
          resource: 'closing_stock',
          resourceId: closingStock.id,
          details: { updates: req.body }
        });
      } catch (auditError) {
        console.warn('Audit log failed for closing stock update:', auditError);
      }
      
      res.json(closingStock);
    } catch (error) {
      res.status(400).json({ message: "Failed to update closing stock" });
    }
  });

  app.delete("/api/closing-stock/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteClosingStock(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Closing stock entry not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted closing stock entry #${req.params.id}`,
          resource: 'closing_stock',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for closing stock deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete closing stock" });
    }
  });

  // Payment Management API
  app.get("/api/payments", authenticateJWT, async (req, res) => {
    try {
      const payments = await storage.getPayments();
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/date/:date", authenticateJWT, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByDate(req.params.date);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payments for date" });
    }
  });

  app.get("/api/payments/order/:orderId", authenticateJWT, async (req, res) => {
    try {
      const payment = await storage.getPaymentByOrderId(req.params.orderId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found for order" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment" });
    }
  });

  app.post("/api/payments", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(validatedData);
      
      // Update order payment status
      await storage.updateOrder(validatedData.orderId, { paymentStatus: "Paid" });
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created payment: $${payment.amount} via ${payment.method} for order #${payment.orderId}`,
          resource: 'payment',
          resourceId: payment.id,
          details: { paymentData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for payment creation:', auditError);
      }
      
      res.status(201).json(payment);
    } catch (error) {
      res.status(400).json({ message: "Invalid payment data" });
    }
  });

  app.put("/api/payments/:id", authenticateJWT, async (req, res) => {
    try {
      const payment = await storage.updatePayment(req.params.id, req.body);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated payment: $${payment.amount} via ${payment.method}`,
          resource: 'payment',
          resourceId: payment.id,
          details: { updates: req.body }
        });
      } catch (auditError) {
        console.warn('Audit log failed for payment update:', auditError);
      }
      
      res.json(payment);
    } catch (error) {
      res.status(400).json({ message: "Failed to update payment" });
    }
  });

  app.delete("/api/payments/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deletePayment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Payment not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted payment #${req.params.id}`,
          resource: 'payment',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for payment deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete payment" });
    }
  });

  // Payment Reports API
  app.get("/api/payment-reports", authenticateJWT, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const fromDate = typeof dateFrom === 'string' ? dateFrom : new Date().toISOString().split('T')[0];
      const toDate = typeof dateTo === 'string' ? dateTo : new Date().toISOString().split('T')[0];
      
      const payments = await storage.getPaymentReports(fromDate, toDate);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payment reports" });
    }
  });

  // Item Types API
  app.get("/api/item-types", authenticateJWT, async (req, res) => {
    try {
      const itemTypes = await storage.getItemTypes();
      res.json(itemTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch item types" });
    }
  });

  app.post("/api/item-types", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertItemTypeSchema.parse(req.body);
      const itemType = await storage.createItemType(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created item type: ${itemType.name} (${itemType.unit})`,
          resource: 'item_type',
          resourceId: itemType.id,
          details: { itemTypeData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for item type creation:', auditError);
      }
      
      res.status(201).json(itemType);
    } catch (error) {
      res.status(400).json({ message: "Invalid item type data" });
    }
  });

  app.put("/api/item-types/:id", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertItemTypeSchema.partial().parse(req.body);
      const itemType = await storage.updateItemType(req.params.id, validatedData);
      if (!itemType) {
        return res.status(404).json({ message: "Item type not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated item type: ${itemType.name} (${itemType.unit})`,
          resource: 'item_type',
          resourceId: itemType.id,
          details: { updates: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for item type update:', auditError);
      }
      
      res.json(itemType);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid item type data" });
      }
      res.status(500).json({ message: "Failed to update item type" });
    }
  });

  app.delete("/api/item-types/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteItemType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Item type not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted item type #${req.params.id}`,
          resource: 'item_type',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for item type deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete item type" });
    }
  });

  // Expense Categories API
  app.get("/api/expense-categories", authenticateJWT, async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });

  app.post("/api/expense-categories", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertExpenseCategorySchema.parse(req.body);
      const category = await storage.createExpenseCategory(validatedData);
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Created expense category: ${category.name}`,
          resource: 'expense_category',
          resourceId: category.id,
          details: { categoryData: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for expense category creation:', auditError);
      }
      
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ message: "Invalid expense category data" });
    }
  });

  app.put("/api/expense-categories/:id", authenticateJWT, async (req, res) => {
    try {
      const validatedData = insertExpenseCategorySchema.partial().parse(req.body);
      const category = await storage.updateExpenseCategory(req.params.id, validatedData);
      if (!category) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Updated expense category: ${category.name}`,
          resource: 'expense_category',
          resourceId: category.id,
          details: { updates: validatedData }
        });
      } catch (auditError) {
        console.warn('Audit log failed for expense category update:', auditError);
      }
      
      res.json(category);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid expense category data" });
      }
      res.status(500).json({ message: "Failed to update expense category" });
    }
  });

  app.delete("/api/expense-categories/:id", authenticateJWT, async (req, res) => {
    try {
      const deleted = await storage.deleteExpenseCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Expense category not found" });
      }
      
      // Audit log (separate try/catch to not affect primary operation)
      try {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: `Deleted expense category #${req.params.id}`,
          resource: 'expense_category',
          resourceId: req.params.id
        });
      } catch (auditError) {
        console.warn('Audit log failed for expense category deletion:', auditError);
      }
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense category" });
    }
  });

  // Admin API Routes - User Management
  app.get("/api/admin/users", authenticateJWT, requirePermission("view:users"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = sanitizeUsers(users);
      res.json(safeUsers);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", authenticateJWT, requirePermission("create:users"), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Hash the password before storing
      if (validatedData.password) {
        validatedData.password = await hashPassword(validatedData.password);
      }
      
      const user = await storage.createUser(validatedData);
      const safeUser = sanitizeUser(user);
      res.status(201).json(safeUser);
    } catch (error) {
      console.error('Create user error:', error);
      res.status(400).json({ message: "Invalid user data" });
    }
  });

  app.put("/api/admin/users/:id", authenticateJWT, requirePermission("edit:users"), async (req, res) => {
    try {
      const validatedData = insertUserSchema.partial().parse(req.body);
      
      // Hash the password if it's being updated
      if (validatedData.password) {
        validatedData.password = await hashPassword(validatedData.password);
      }
      
      const user = await storage.updateUser(req.params.id, validatedData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const safeUser = sanitizeUser(user);
      res.json(safeUser);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", authenticateJWT, requirePermission("delete:users"), async (req, res) => {
    try {
      // Prevent deletion of current user
      if (req.params.id === req.user?.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // User Role Assignment
  app.get("/api/admin/users/:id/roles", authenticateJWT, requirePermission("view:users"), async (req, res) => {
    try {
      const userRoles = await storage.getUserRoles(req.params.id);
      const roles = await storage.getRoles();
      const userRoleData = userRoles.map(ur => {
        const role = roles.find(r => r.id === ur.roleId);
        return {
          id: ur.id,
          roleId: ur.roleId,
          roleName: role?.name,
          assignedBy: ur.assignedBy,
          createdAt: ur.createdAt
        };
      });
      res.json(userRoleData);
    } catch (error) {
      console.error('Get user roles error:', error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  app.post("/api/admin/users/:id/roles", authenticateJWT, requirePermission("edit:users"), async (req, res) => {
    try {
      const validatedData = insertUserRoleSchema.parse({
        ...req.body,
        userId: req.params.id,
        assignedBy: req.user?.id
      });
      const userRole = await storage.assignRoleToUser(validatedData);
      res.status(201).json(userRole);
    } catch (error) {
      console.error('Assign role error:', error);
      res.status(400).json({ message: "Failed to assign role" });
    }
  });

  app.delete("/api/admin/users/:userId/roles/:roleId", authenticateJWT, requirePermission("edit:users"), async (req, res) => {
    try {
      const deleted = await storage.removeRoleFromUser(req.params.userId, req.params.roleId);
      if (!deleted) {
        return res.status(404).json({ message: "User role assignment not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error('Remove role error:', error);
      res.status(500).json({ message: "Failed to remove role" });
    }
  });

  // Admin API Routes - Role Management
  app.get("/api/admin/roles", authenticateJWT, requirePermission("view:roles"), async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/admin/roles", authenticateJWT, requirePermission("create:roles"), async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      res.status(201).json(role);
    } catch (error) {
      console.error('Create role error:', error);
      res.status(400).json({ message: "Invalid role data" });
    }
  });

  app.put("/api/admin/roles/:id", authenticateJWT, requirePermission("edit:roles"), async (req, res) => {
    try {
      const validatedData = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(req.params.id, validatedData);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error('Update role error:', error);
      res.status(400).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/admin/roles/:id", authenticateJWT, requirePermission("delete:roles"), async (req, res) => {
    try {
      const deleted = await storage.deleteRole(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Role Permission Assignment
  app.get("/api/admin/roles/:id/permissions", authenticateJWT, requirePermission("view:roles"), async (req, res) => {
    try {
      const rolePermissions = await storage.getRolePermissions(req.params.id);
      const permissions = await storage.getPermissions();
      const rolePermissionData = rolePermissions.map(rp => {
        const permission = permissions.find(p => p.id === rp.permissionId);
        return {
          id: rp.id,
          permissionId: rp.permissionId,
          permissionName: permission?.name,
          permissionDescription: permission?.description,
          resource: permission?.resource,
          action: permission?.action,
          createdAt: rp.createdAt
        };
      });
      res.json(rolePermissionData);
    } catch (error) {
      console.error('Get role permissions error:', error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/admin/roles/:id/permissions", authenticateJWT, requirePermission("edit:roles"), async (req, res) => {
    try {
      const validatedData = insertRolePermissionSchema.parse({
        ...req.body,
        roleId: req.params.id
      });
      const rolePermission = await storage.assignPermissionToRole(validatedData);
      res.status(201).json(rolePermission);
    } catch (error) {
      console.error('Assign permission error:', error);
      res.status(400).json({ message: "Failed to assign permission" });
    }
  });

  app.delete("/api/admin/roles/:roleId/permissions/:permissionId", authenticateJWT, requirePermission("edit:roles"), async (req, res) => {
    try {
      const deleted = await storage.removePermissionFromRole(req.params.roleId, req.params.permissionId);
      if (!deleted) {
        return res.status(404).json({ message: "Role permission assignment not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error('Remove permission error:', error);
      res.status(500).json({ message: "Failed to remove permission" });
    }
  });

  // Admin API Routes - Permission Management
  app.get("/api/admin/permissions", authenticateJWT, requirePermission("view:roles"), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      console.error('Get permissions error:', error);
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.post("/api/admin/permissions", authenticateJWT, requirePermission("create:roles"), async (req, res) => {
    try {
      const validatedData = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(validatedData);
      res.status(201).json(permission);
    } catch (error) {
      console.error('Create permission error:', error);
      res.status(400).json({ message: "Invalid permission data" });
    }
  });

  app.put("/api/admin/permissions/:id", authenticateJWT, requirePermission("edit:roles"), async (req, res) => {
    try {
      const validatedData = insertPermissionSchema.partial().parse(req.body);
      const permission = await storage.updatePermission(req.params.id, validatedData);
      if (!permission) {
        return res.status(404).json({ message: "Permission not found" });
      }
      res.json(permission);
    } catch (error) {
      console.error('Update permission error:', error);
      res.status(400).json({ message: "Failed to update permission" });
    }
  });

  app.delete("/api/admin/permissions/:id", authenticateJWT, requirePermission("delete:roles"), async (req, res) => {
    try {
      const deleted = await storage.deletePermission(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Permission not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error('Delete permission error:', error);
      res.status(500).json({ message: "Failed to delete permission" });
    }
  });

  // Admin API Routes - Audit Logs
  app.get("/api/admin/audit-logs", authenticateJWT, requireRole("Admin"), async (req, res) => {
    try {
      const filters = {
        userId: req.query.userId as string,
        action: req.query.action as string,
        resource: req.query.resource as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });

      const { logs, total } = await storage.getAuditLogs(filters);
      res.json({ logs, total, filters });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Get current user's permissions (for UI controls)
  app.get("/api/user/permissions", authenticateJWT, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const permissions = await storage.getUserPermissions(req.user.id);
      const permissionNames = permissions.map(p => p.name);
      res.json({ permissions: permissionNames });
    } catch (error) {
      console.error('Get user permissions error:', error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
