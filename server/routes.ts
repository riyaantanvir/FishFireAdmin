import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertOrderSchema, insertItemSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Orders API
  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ message: "Invalid order data" });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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

  app.delete("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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

  // Items API
  app.get("/api/items", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const items = await storage.getItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post("/api/items", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const validatedData = insertItemSchema.parse(req.body);
      const item = await storage.createItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid item data" });
    }
  });

  app.put("/api/items/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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

  app.delete("/api/items/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
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

  const httpServer = createServer(app);
  return httpServer;
}
