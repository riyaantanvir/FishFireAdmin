import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, authenticateJWT } from "./auth";
import { storage } from "./storage";
import { insertOrderSchema, insertItemSchema, insertExpenseSchema, insertOpeningStockSchema, insertClosingStockSchema } from "@shared/schema";

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
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense" });
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
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Failed to delete closing stock" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
