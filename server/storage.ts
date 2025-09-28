import { type User, type InsertUser, type Order, type InsertOrder, type Item, type InsertItem, type Expense, type InsertExpense, type OpeningStock, type InsertOpeningStock, type ClosingStock, type InsertClosingStock, type Payment, type InsertPayment } from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  clearAllOrders(): Promise<number>;
  
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, item: Partial<Item>): Promise<Item | undefined>;
  deleteItem(id: string): Promise<boolean>;
  
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<Expense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getOpeningStockByDate(date: string): Promise<OpeningStock[]>;
  createOpeningStock(openingStock: InsertOpeningStock): Promise<OpeningStock>;
  updateOpeningStock(id: string, openingStock: Partial<OpeningStock>): Promise<OpeningStock | undefined>;
  deleteOpeningStock(id: string): Promise<boolean>;
  
  getClosingStockByDate(date: string): Promise<ClosingStock[]>;
  createClosingStock(closingStock: InsertClosingStock): Promise<ClosingStock>;
  updateClosingStock(id: string, closingStock: Partial<ClosingStock>): Promise<ClosingStock | undefined>;
  deleteClosingStock(id: string): Promise<boolean>;
  
  getPayments(): Promise<Payment[]>;
  getPaymentsByDate(date: string): Promise<Payment[]>;
  getPaymentByOrderId(orderId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<Payment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<boolean>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private orders: Map<string, Order>;
  private items: Map<string, Item>;
  private expenses: Map<string, Expense>;
  private openingStock: Map<string, OpeningStock>;
  private closingStock: Map<string, ClosingStock>;
  private payments: Map<string, Payment>;
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.orders = new Map();
    this.items = new Map();
    this.expenses = new Map();
    this.openingStock = new Map();
    this.closingStock = new Map();
    this.payments = new Map();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
      ttl: 86400000, // 24 hours TTL
    });
    
    // Create default admin user immediately - no async needed
    this.createDefaultAdminSync();
  }

  private createDefaultAdminSync() {
    // Create admin with a simple hash format for demo purposes
    const adminUser: User = {
      id: randomUUID(),
      username: "Admin",
      password: "admin_hashed_password", // We'll handle this specially in auth
      role: "admin",
      createdAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);
    console.log(`Created admin user with ID: ${adminUser.id}`);
  }

  private async hashPassword(password: string): Promise<string> {
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "user",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const order: Order = {
      ...insertOrder,
      id,
      status: insertOrder.status || "pending",
      createdAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, orderUpdate: Partial<Order>): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
    const updatedOrder = { ...existingOrder, ...orderUpdate };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  async clearAllOrders(): Promise<number> {
    const count = this.orders.size;
    this.orders.clear();
    return count;
  }

  async getItems(): Promise<Item[]> {
    return Array.from(this.items.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getItem(id: string): Promise<Item | undefined> {
    return this.items.get(id);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const id = randomUUID();
    const item: Item = {
      ...insertItem,
      id,
      description: insertItem.description || null,
      stock: insertItem.stock || 0,
      isActive: insertItem.isActive || "true",
      weightPerPCS: insertItem.weightPerPCS || null,
      sellingPricePerKG: insertItem.sellingPricePerKG || null,
      sellingPricePerPCS: insertItem.sellingPricePerPCS || null,
      createdAt: new Date(),
    };
    this.items.set(id, item);
    return item;
  }

  async updateItem(id: string, itemUpdate: Partial<Item>): Promise<Item | undefined> {
    const existingItem = this.items.get(id);
    if (!existingItem) return undefined;
    
    const updatedItem = { ...existingItem, ...itemUpdate };
    this.items.set(id, updatedItem);
    return updatedItem;
  }

  async deleteItem(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = {
      ...insertExpense,
      id,
      weight: insertExpense.weight || null,
      qty: insertExpense.qty || 1,
      dueAmount: insertExpense.dueAmount || null,
      comment: insertExpense.comment || null,
      createdAt: new Date(),
    };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: string, expenseUpdate: Partial<Expense>): Promise<Expense | undefined> {
    const existingExpense = this.expenses.get(id);
    if (!existingExpense) return undefined;
    
    const updatedExpense = { ...existingExpense, ...expenseUpdate };
    this.expenses.set(id, updatedExpense);
    return updatedExpense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenses.delete(id);
  }

  async getOpeningStockByDate(date: string): Promise<OpeningStock[]> {
    return Array.from(this.openingStock.values()).filter(stock => stock.date === date);
  }

  async createOpeningStock(insertOpeningStock: InsertOpeningStock): Promise<OpeningStock> {
    const id = randomUUID();
    const openingStock: OpeningStock = {
      ...insertOpeningStock,
      id,
      createdAt: new Date(),
    };
    this.openingStock.set(id, openingStock);
    return openingStock;
  }

  async updateOpeningStock(id: string, stockUpdate: Partial<OpeningStock>): Promise<OpeningStock | undefined> {
    const existingStock = this.openingStock.get(id);
    if (!existingStock) return undefined;
    
    const updatedStock = { ...existingStock, ...stockUpdate };
    this.openingStock.set(id, updatedStock);
    return updatedStock;
  }

  async deleteOpeningStock(id: string): Promise<boolean> {
    return this.openingStock.delete(id);
  }

  async getClosingStockByDate(date: string): Promise<ClosingStock[]> {
    return Array.from(this.closingStock.values()).filter(stock => stock.date === date);
  }

  async createClosingStock(insertClosingStock: InsertClosingStock): Promise<ClosingStock> {
    const id = randomUUID();
    const closingStock: ClosingStock = {
      ...insertClosingStock,
      id,
      createdAt: new Date(),
    };
    this.closingStock.set(id, closingStock);
    return closingStock;
  }

  async updateClosingStock(id: string, stockUpdate: Partial<ClosingStock>): Promise<ClosingStock | undefined> {
    const existingStock = this.closingStock.get(id);
    if (!existingStock) return undefined;
    
    const updatedStock = { ...existingStock, ...stockUpdate };
    this.closingStock.set(id, updatedStock);
    return updatedStock;
  }

  async deleteClosingStock(id: string): Promise<boolean> {
    return this.closingStock.delete(id);
  }

  async getPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  async getPaymentsByDate(date: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(payment => payment.paymentDate === date);
  }

  async getPaymentByOrderId(orderId: string): Promise<Payment | undefined> {
    return Array.from(this.payments.values()).find(payment => payment.orderId === orderId);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = {
      ...insertPayment,
      id,
      createdAt: new Date(),
    };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: string, paymentUpdate: Partial<Payment>): Promise<Payment | undefined> {
    const existingPayment = this.payments.get(id);
    if (!existingPayment) return undefined;
    
    const updatedPayment = { ...existingPayment, ...paymentUpdate };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async deletePayment(id: string): Promise<boolean> {
    return this.payments.delete(id);
  }
}

export const storage = new MemStorage();
