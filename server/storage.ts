import { type User, type InsertUser, type Order, type InsertOrder, type Item, type InsertItem, type Expense, type InsertExpense, type OpeningStock, type InsertOpeningStock, type ClosingStock, type InsertClosingStock, type Payment, type InsertPayment, type ItemType, type InsertItemType, type ExpenseCategory, type InsertExpenseCategory, type Role, type InsertRole, type Permission, type InsertPermission, type RolePermission, type InsertRolePermission, type UserRole, type InsertUserRole, type AuditLog, type InsertAuditLog } from "@shared/schema";
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
  deleteAllExpenses(): Promise<number>;
  
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
  getPaymentReports(dateFrom: string, dateTo: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<Payment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<boolean>;
  
  getItemTypes(): Promise<ItemType[]>;
  getItemType(id: string): Promise<ItemType | undefined>;
  createItemType(itemType: InsertItemType): Promise<ItemType>;
  updateItemType(id: string, itemType: Partial<ItemType>): Promise<ItemType | undefined>;
  deleteItemType(id: string): Promise<boolean>;
  
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(expenseCategory: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, expenseCategory: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string): Promise<boolean>;
  
  // User Management (Enhanced)
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  updateUserLastLogin(id: string): Promise<void>;
  
  // Role Management
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<Role>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  
  // Permission Management
  getPermissions(): Promise<Permission[]>;
  getPermission(id: string): Promise<Permission | undefined>;
  getPermissionByName(name: string): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  updatePermission(id: string, permission: Partial<Permission>): Promise<Permission | undefined>;
  deletePermission(id: string): Promise<boolean>;
  
  // Role-Permission Management
  getRolePermissions(roleId: string): Promise<RolePermission[]>;
  assignPermissionToRole(rolePermission: InsertRolePermission): Promise<RolePermission>;
  removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean>;
  
  // User-Role Management
  getUserRoles(userId: string): Promise<UserRole[]>;
  assignRoleToUser(userRole: InsertUserRole): Promise<UserRole>;
  removeRoleFromUser(userId: string, roleId: string): Promise<boolean>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  
  // Audit Logging
  getAuditLogs(filters?: { userId?: string; action?: string; resource?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }): Promise<{ logs: AuditLog[]; total: number }>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  
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
  private itemTypes: Map<string, ItemType>;
  private expenseCategories: Map<string, ExpenseCategory>;
  
  // RBAC Data Structures
  private roles: Map<string, Role>;
  private permissions: Map<string, Permission>;
  private rolePermissions: Map<string, RolePermission>;
  private userRoles: Map<string, UserRole>;
  private auditLogs: Map<string, AuditLog>;
  
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.orders = new Map();
    this.items = new Map();
    this.expenses = new Map();
    this.openingStock = new Map();
    this.closingStock = new Map();
    this.payments = new Map();
    this.itemTypes = new Map();
    this.expenseCategories = new Map();
    
    // Initialize RBAC Maps
    this.roles = new Map();
    this.permissions = new Map();
    this.rolePermissions = new Map();
    this.userRoles = new Map();
    this.auditLogs = new Map();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
      ttl: 86400000, // 24 hours TTL
    });
    
    // Initialize default data
    this.initializeDefaultRBACData();
    this.createDefaultAdminSync();
  }

  private initializeDefaultRBACData() {
    // Create default roles
    const defaultRoles = [
      { name: "Admin", description: "Full system access" },
      { name: "Manager", description: "Management level access" },
      { name: "Cashier", description: "Point of sale operations" },
      { name: "Kitchen", description: "Kitchen operations access" },
      { name: "Staff", description: "Basic staff access" }
    ];

    // Create default permissions
    const defaultPermissions = [
      { name: "view:orders", resource: "orders", action: "view", description: "View orders" },
      { name: "create:orders", resource: "orders", action: "create", description: "Create orders" },
      { name: "edit:orders", resource: "orders", action: "edit", description: "Edit orders" },
      { name: "delete:orders", resource: "orders", action: "delete", description: "Delete orders" },
      { name: "export:orders", resource: "orders", action: "export", description: "Export orders" },
      
      { name: "view:items", resource: "items", action: "view", description: "View items" },
      { name: "create:items", resource: "items", action: "create", description: "Create items" },
      { name: "edit:items", resource: "items", action: "edit", description: "Edit items" },
      { name: "delete:items", resource: "items", action: "delete", description: "Delete items" },
      { name: "export:items", resource: "items", action: "export", description: "Export items" },
      
      { name: "view:expenses", resource: "expenses", action: "view", description: "View expenses" },
      { name: "create:expenses", resource: "expenses", action: "create", description: "Create expenses" },
      { name: "edit:expenses", resource: "expenses", action: "edit", description: "Edit expenses" },
      { name: "delete:expenses", resource: "expenses", action: "delete", description: "Delete expenses" },
      { name: "export:expenses", resource: "expenses", action: "export", description: "Export expenses" },
      
      { name: "view:users", resource: "users", action: "view", description: "View users" },
      { name: "create:users", resource: "users", action: "create", description: "Create users" },
      { name: "edit:users", resource: "users", action: "edit", description: "Edit users" },
      { name: "delete:users", resource: "users", action: "delete", description: "Delete users" },
      
      { name: "view:roles", resource: "roles", action: "view", description: "View roles" },
      { name: "create:roles", resource: "roles", action: "create", description: "Create roles" },
      { name: "edit:roles", resource: "roles", action: "edit", description: "Edit roles" },
      { name: "delete:roles", resource: "roles", action: "delete", description: "Delete roles" },
      
      { name: "view:reports", resource: "reports", action: "view", description: "View reports" },
      { name: "export:reports", resource: "reports", action: "export", description: "Export reports" },
      
      { name: "view:stock", resource: "stock", action: "view", description: "View stock" },
      { name: "create:stock", resource: "stock", action: "create", description: "Create stock entries" },
      { name: "edit:stock", resource: "stock", action: "edit", description: "Edit stock entries" }
    ];

    // Create roles
    defaultRoles.forEach(roleData => {
      const id = randomUUID();
      const role: Role = {
        id,
        name: roleData.name,
        description: roleData.description,
        isActive: true,
        createdAt: new Date()
      };
      this.roles.set(id, role);
    });

    // Create permissions
    defaultPermissions.forEach(permData => {
      const id = randomUUID();
      const permission: Permission = {
        id,
        name: permData.name,
        resource: permData.resource,
        action: permData.action,
        description: permData.description,
        createdAt: new Date()
      };
      this.permissions.set(id, permission);
    });

    // Assign permissions to Admin role (all permissions)
    const adminRole = Array.from(this.roles.values()).find(r => r.name === "Admin");
    if (adminRole) {
      Array.from(this.permissions.values()).forEach(permission => {
        const id = randomUUID();
        const rolePermission: RolePermission = {
          id,
          roleId: adminRole.id,
          permissionId: permission.id,
          createdAt: new Date()
        };
        this.rolePermissions.set(id, rolePermission);
      });
    }
  }

  private createDefaultAdminSync() {
    // Create admin with a simple hash format for demo purposes
    const adminUser: User = {
      id: randomUUID(),
      username: "Admin",
      password: "admin_hashed_password", // We'll handle this specially in auth
      role: "admin",
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Assign Admin role to the admin user
    const adminRole = Array.from(this.roles.values()).find(r => r.name === "Admin");
    if (adminRole) {
      const userRoleId = randomUUID();
      const userRole: UserRole = {
        id: userRoleId,
        userId: adminUser.id,
        roleId: adminRole.id,
        assignedBy: null, // System assigned
        createdAt: new Date()
      };
      this.userRoles.set(userRoleId, userRole);
    }

    console.log(`Created admin user with ID: ${adminUser.id}`);
    
    // Create default items
    this.createDefaultItems();
  }

  private createDefaultItems() {
    const today = new Date().toISOString().split('T')[0];
    
    const defaultItems = [
      { name: "Tilapia Fish", saleType: "Per KG", price: 250, unit: "KG" },
      { name: "Rui Fish", saleType: "Per KG", price: 350, unit: "KG" },
      { name: "Katla Fish", saleType: "Per KG", price: 300, unit: "KG" },
      { name: "Hilsa Fish", saleType: "Per KG", price: 1200, unit: "KG" },
      { name: "Pangas Fish", saleType: "Per KG", price: 180, unit: "KG" },
      { name: "Shrimp", saleType: "Per KG", price: 800, unit: "KG" },
      { name: "Crab", saleType: "Per PCS", price: 150, unit: "PCS" },
      { name: "Lobster", saleType: "Per PCS", price: 500, unit: "PCS" },
    ];

    let itemNumber = 1;
    defaultItems.forEach(itemData => {
      const id = randomUUID();
      const item: Item = {
        id,
        itemNumber,
        date: today,
        name: itemData.name,
        saleType: itemData.saleType,
        price: itemData.price.toString(),
        unit: itemData.unit,
        createdAt: new Date()
      };
      this.items.set(id, item);
      itemNumber++;
    });

    console.log(`Created ${defaultItems.length} default items`);
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
      isActive: insertUser.isActive ?? true,
      lastLoginAt: null,
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
    const now = new Date();
    const order: Order = {
      ...insertOrder,
      id,
      status: insertOrder.status || "pending",
      paymentStatus: insertOrder.paymentStatus || "Unpaid",
      customerName: insertOrder.customerName || null,
      kitchenStatus: insertOrder.kitchenStatus || "Pending",
      kitchenReceivedAt: insertOrder.kitchenReceivedAt || now,
      kitchenStartedAt: insertOrder.kitchenStartedAt || null,
      kitchenReadyAt: insertOrder.kitchenReadyAt || null,
      kitchenServedAt: insertOrder.kitchenServedAt || null,
      createdAt: now,
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

  async deleteAllExpenses(): Promise<number> {
    const count = this.expenses.size;
    this.expenses.clear();
    return count;
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

  async getPaymentReports(dateFrom: string, dateTo: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(payment => 
      payment.paymentDate >= dateFrom && payment.paymentDate <= dateTo
    );
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = {
      ...insertPayment,
      id,
      customerName: insertPayment.customerName || null,
      cash1000: insertPayment.cash1000 || 0,
      cash500: insertPayment.cash500 || 0,
      cash200: insertPayment.cash200 || 0,
      cash100: insertPayment.cash100 || 0,
      cash50: insertPayment.cash50 || 0,
      cash20: insertPayment.cash20 || 0,
      cash10: insertPayment.cash10 || 0,
      cash5: insertPayment.cash5 || 0,
      cash2: insertPayment.cash2 || 0,
      cash1: insertPayment.cash1 || 0,
      totalCash: insertPayment.totalCash || "0",
      bkash: insertPayment.bkash || "0",
      rocket: insertPayment.rocket || "0",
      nogod: insertPayment.nogod || "0",
      card: insertPayment.card || "0",
      bank: insertPayment.bank || "0",
      totalDigital: insertPayment.totalDigital || "0",
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

  // Item Types methods
  async getItemTypes(): Promise<ItemType[]> {
    return Array.from(this.itemTypes.values());
  }

  async getItemType(id: string): Promise<ItemType | undefined> {
    return this.itemTypes.get(id);
  }

  async createItemType(insertItemType: InsertItemType): Promise<ItemType> {
    const id = randomUUID();
    const itemType: ItemType = {
      ...insertItemType,
      id,
      description: insertItemType.description || null,
      isActive: insertItemType.isActive || "true",
      createdAt: new Date(),
    };
    this.itemTypes.set(id, itemType);
    return itemType;
  }

  async updateItemType(id: string, itemTypeUpdate: Partial<ItemType>): Promise<ItemType | undefined> {
    const existingItemType = this.itemTypes.get(id);
    if (!existingItemType) return undefined;
    
    const updatedItemType = { ...existingItemType, ...itemTypeUpdate };
    this.itemTypes.set(id, updatedItemType);
    return updatedItemType;
  }

  async deleteItemType(id: string): Promise<boolean> {
    return this.itemTypes.delete(id);
  }

  // Expense Categories methods
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return Array.from(this.expenseCategories.values());
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    return this.expenseCategories.get(id);
  }

  async createExpenseCategory(insertExpenseCategory: InsertExpenseCategory): Promise<ExpenseCategory> {
    const id = randomUUID();
    const expenseCategory: ExpenseCategory = {
      ...insertExpenseCategory,
      id,
      description: insertExpenseCategory.description || null,
      isActive: insertExpenseCategory.isActive || "true",
      createdAt: new Date(),
    };
    this.expenseCategories.set(id, expenseCategory);
    return expenseCategory;
  }

  async updateExpenseCategory(id: string, categoryUpdate: Partial<ExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const existingCategory = this.expenseCategories.get(id);
    if (!existingCategory) return undefined;
    
    const updatedCategory = { ...existingCategory, ...categoryUpdate };
    this.expenseCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteExpenseCategory(id: string): Promise<boolean> {
    return this.expenseCategories.delete(id);
  }

  // Enhanced User Management Methods
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async updateUser(id: string, userUpdate: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { ...existingUser, ...userUpdate };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Also remove user roles when deleting user
    const userRolesToDelete = Array.from(this.userRoles.values())
      .filter(ur => ur.userId === id);
    userRolesToDelete.forEach(ur => this.userRoles.delete(ur.id));
    
    return this.users.delete(id);
  }

  async updateUserLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      this.users.set(id, user);
    }
  }

  // Role Management Methods
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRole(id: string): Promise<Role | undefined> {
    return this.roles.get(id);
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    return Array.from(this.roles.values()).find(role => role.name === name);
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const id = randomUUID();
    const role: Role = {
      ...insertRole,
      id,
      description: insertRole.description || null,
      isActive: insertRole.isActive ?? true,
      createdAt: new Date(),
    };
    this.roles.set(id, role);
    return role;
  }

  async updateRole(id: string, roleUpdate: Partial<Role>): Promise<Role | undefined> {
    const existingRole = this.roles.get(id);
    if (!existingRole) return undefined;
    
    const updatedRole = { ...existingRole, ...roleUpdate };
    this.roles.set(id, updatedRole);
    return updatedRole;
  }

  async deleteRole(id: string): Promise<boolean> {
    // Remove role permissions and user roles when deleting role
    const rolePermissionsToDelete = Array.from(this.rolePermissions.values())
      .filter(rp => rp.roleId === id);
    rolePermissionsToDelete.forEach(rp => this.rolePermissions.delete(rp.id));
    
    const userRolesToDelete = Array.from(this.userRoles.values())
      .filter(ur => ur.roleId === id);
    userRolesToDelete.forEach(ur => this.userRoles.delete(ur.id));
    
    return this.roles.delete(id);
  }

  // Permission Management Methods
  async getPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    return this.permissions.get(id);
  }

  async getPermissionByName(name: string): Promise<Permission | undefined> {
    return Array.from(this.permissions.values()).find(permission => permission.name === name);
  }

  async createPermission(insertPermission: InsertPermission): Promise<Permission> {
    const id = randomUUID();
    const permission: Permission = {
      ...insertPermission,
      id,
      description: insertPermission.description || null,
      createdAt: new Date(),
    };
    this.permissions.set(id, permission);
    return permission;
  }

  async updatePermission(id: string, permissionUpdate: Partial<Permission>): Promise<Permission | undefined> {
    const existingPermission = this.permissions.get(id);
    if (!existingPermission) return undefined;
    
    const updatedPermission = { ...existingPermission, ...permissionUpdate };
    this.permissions.set(id, updatedPermission);
    return updatedPermission;
  }

  async deletePermission(id: string): Promise<boolean> {
    // Remove role permissions when deleting permission
    const rolePermissionsToDelete = Array.from(this.rolePermissions.values())
      .filter(rp => rp.permissionId === id);
    rolePermissionsToDelete.forEach(rp => this.rolePermissions.delete(rp.id));
    
    return this.permissions.delete(id);
  }

  // Role-Permission Management Methods
  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    return Array.from(this.rolePermissions.values()).filter(rp => rp.roleId === roleId);
  }

  async assignPermissionToRole(insertRolePermission: InsertRolePermission): Promise<RolePermission> {
    const id = randomUUID();
    const rolePermission: RolePermission = {
      ...insertRolePermission,
      id,
      createdAt: new Date(),
    };
    this.rolePermissions.set(id, rolePermission);
    return rolePermission;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const rolePermission = Array.from(this.rolePermissions.values())
      .find(rp => rp.roleId === roleId && rp.permissionId === permissionId);
    
    if (rolePermission) {
      return this.rolePermissions.delete(rolePermission.id);
    }
    return false;
  }

  // User-Role Management Methods
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return Array.from(this.userRoles.values()).filter(ur => ur.userId === userId);
  }

  async assignRoleToUser(insertUserRole: InsertUserRole): Promise<UserRole> {
    const id = randomUUID();
    const userRole: UserRole = {
      ...insertUserRole,
      id,
      assignedBy: insertUserRole.assignedBy || null,
      createdAt: new Date(),
    };
    this.userRoles.set(id, userRole);
    return userRole;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const userRole = Array.from(this.userRoles.values())
      .find(ur => ur.userId === userId && ur.roleId === roleId);
    
    if (userRole) {
      return this.userRoles.delete(userRole.id);
    }
    return false;
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    // Get user roles
    const userRoles = await this.getUserRoles(userId);
    const roleIds = userRoles.map(ur => ur.roleId);
    
    // Get permissions for those roles
    const rolePermissions = Array.from(this.rolePermissions.values())
      .filter(rp => roleIds.includes(rp.roleId));
    const permissionIds = rolePermissions.map(rp => rp.permissionId);
    
    // Return unique permissions
    const permissions = Array.from(this.permissions.values())
      .filter(p => permissionIds.includes(p.id));
    
    return permissions;
  }

  // Audit Logging Methods
  async getAuditLogs(filters?: { 
    userId?: string; 
    action?: string; 
    resource?: string; 
    dateFrom?: string; 
    dateTo?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<{ logs: AuditLog[]; total: number }> {
    let logs = Array.from(this.auditLogs.values());
    
    // Apply filters
    if (filters?.userId) {
      logs = logs.filter(log => log.userId === filters.userId);
    }
    if (filters?.action) {
      logs = logs.filter(log => log.action === filters.action);
    }
    if (filters?.resource) {
      logs = logs.filter(log => log.resource === filters.resource);
    }
    if (filters?.dateFrom) {
      logs = logs.filter(log => 
        log.createdAt && log.createdAt >= new Date(filters.dateFrom!)
      );
    }
    if (filters?.dateTo) {
      logs = logs.filter(log => 
        log.createdAt && log.createdAt <= new Date(filters.dateTo!)
      );
    }
    
    // Sort by creation date (newest first)
    logs.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    
    const total = logs.length;
    
    // Apply pagination
    if (filters?.offset || filters?.limit) {
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      logs = logs.slice(offset, offset + limit);
    }
    
    return { logs, total };
  }

  async createAuditLog(insertAuditLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const auditLog: AuditLog = {
      ...insertAuditLog,
      id,
      userId: insertAuditLog.userId || null,
      resourceId: insertAuditLog.resourceId || null,
      oldData: insertAuditLog.oldData || null,
      newData: insertAuditLog.newData || null,
      metadata: insertAuditLog.metadata || null,
      ipAddress: insertAuditLog.ipAddress || null,
      userAgent: insertAuditLog.userAgent || null,
      errorMessage: insertAuditLog.errorMessage || null,
      actorName: insertAuditLog.actorName || null,
      success: insertAuditLog.success ?? true,
      createdAt: new Date(),
    };
    this.auditLogs.set(id, auditLog);
    return auditLog;
  }
}

export const storage = new MemStorage();
