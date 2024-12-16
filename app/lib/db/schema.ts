import {
  pgTable,
  unique,
  uuid,
  varchar,
  text,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    name: varchar({ length: 255 }).notNull(),
    email: text().notNull(),
    password: text().notNull(),
  },
  (table) => [unique("users_email_key").on(table.email)]
);

export const customers = pgTable("customers", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  imageUrl: varchar("image_url", { length: 255 }).notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid()
    .default(sql`uuid_generate_v4()`)
    .primaryKey()
    .notNull(),
  customerId: uuid("customer_id").notNull(),
  amount: integer().notNull(),
  status: varchar({ length: 255 }).notNull(),
  date: date().notNull(),
});

export const revenue = pgTable(
  "revenue",
  {
    month: varchar({ length: 4 }).notNull(),
    revenue: integer().notNull(),
  },
  (table) => [unique("revenue_month_key").on(table.month)]
);
