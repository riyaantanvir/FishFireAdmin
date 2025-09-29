import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  items: text("items").notNull(), // JSON string of order items
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("Unpaid"), // Paid, Unpaid, Partial
  orderDate: text("order_date").notNull(), // User-specified order date
  createdAt: timestamp("created_at").defaultNow(),
});

export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemNumber: integer("item_number").notNull(),
  date: text("date").notNull(), // User-specified date
  name: text("name").notNull(),
  itemType: text("item_type").notNull(), // Fish / Non-Fish / Drinks / Other
  itemSaleType: text("item_sale_type").notNull(), // Per KG / Per PCS
  weightPerPCS: decimal("weight_per_pcs", { precision: 10, scale: 3 }), // Weight in KG when sold per PCS
  sellingPricePerKG: decimal("selling_price_per_kg", { precision: 10, scale: 2 }),
  sellingPricePerPCS: decimal("selling_price_per_pcs", { precision: 10, scale: 2 }),
  // Legacy fields for compatibility
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  category: text("category").notNull(),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // User-specified date
  personItem: text("person_item").notNull(), // Person or Item name
  category: text("category").notNull(),
  weight: decimal("weight", { precision: 10, scale: 3 }), // Optional weight
  qty: integer("qty").notNull().default(1),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueAmount: decimal("due_amount", { precision: 10, scale: 2 }), // Optional due amount
  comment: text("comment"), // Optional comment
  createdAt: timestamp("created_at").defaultNow(),
});

export const openingStock = pgTable("opening_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // Date of stock entry
  itemId: varchar("item_id").notNull(), // Reference to item
  itemName: text("item_name").notNull(), // Item name for easier querying
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(), // Opening stock quantity
  unit: text("unit").notNull(), // PCS or KG
  createdAt: timestamp("created_at").defaultNow(),
});

export const closingStock = pgTable("closing_stock", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(), // Date of stock entry
  itemId: varchar("item_id").notNull(), // Reference to item
  itemName: text("item_name").notNull(), // Item name for easier querying
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(), // Closing stock quantity
  unit: text("unit").notNull(), // PCS or KG
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(), // Reference to order
  orderNumber: text("order_number").notNull(), // For easier querying
  customerName: text("customer_name").notNull(), // For easier querying
  orderTotal: decimal("order_total", { precision: 10, scale: 2 }).notNull(),
  totalPaid: decimal("total_paid", { precision: 10, scale: 2 }).notNull(),
  // Cash breakdown
  cash1000: integer("cash_1000").default(0),
  cash500: integer("cash_500").default(0),
  cash200: integer("cash_200").default(0),
  cash100: integer("cash_100").default(0),
  cash50: integer("cash_50").default(0),
  cash20: integer("cash_20").default(0),
  cash10: integer("cash_10").default(0),
  cash5: integer("cash_5").default(0),
  cash2: integer("cash_2").default(0),
  cash1: integer("cash_1").default(0),
  totalCash: decimal("total_cash", { precision: 10, scale: 2 }).default("0"),
  // Digital payments
  bkash: decimal("bkash", { precision: 10, scale: 2 }).default("0"),
  rocket: decimal("rocket", { precision: 10, scale: 2 }).default("0"),
  nogod: decimal("nogod", { precision: 10, scale: 2 }).default("0"),
  card: decimal("card", { precision: 10, scale: 2 }).default("0"),
  bank: decimal("bank", { precision: 10, scale: 2 }).default("0"),
  totalDigital: decimal("total_digital", { precision: 10, scale: 2 }).default("0"),
  paymentDate: text("payment_date").notNull(), // Date of payment
  createdAt: timestamp("created_at").defaultNow(),
});

export const itemTypes = pgTable("item_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // Fish, Non-Fish, Drinks, Other, etc.
  description: text("description"), // Optional description
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // Transportation, Supplies, Food, etc.
  description: text("description"), // Optional description
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
}).extend({
  role: z.enum(["user", "admin"]).optional(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});

export const insertOpeningStockSchema = createInsertSchema(openingStock).omit({
  id: true,
  createdAt: true,
});

export const insertClosingStockSchema = createInsertSchema(closingStock).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertItemTypeSchema = createInsertSchema(itemTypes).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertOpeningStock = z.infer<typeof insertOpeningStockSchema>;
export type OpeningStock = typeof openingStock.$inferSelect;
export type InsertClosingStock = z.infer<typeof insertClosingStockSchema>;
export type ClosingStock = typeof closingStock.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertItemType = z.infer<typeof insertItemTypeSchema>;
export type ItemType = typeof itemTypes.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
