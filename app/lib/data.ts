import { sql } from "drizzle-orm";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
// import { supabase } from "./supabaseClient";
import { db } from "./db/drizzle";
import { revenue } from "./db/schema";
import { formatCurrency } from "./utils";
import { desc, eq, count, or, ilike } from "drizzle-orm";
import { customers, invoices } from "./db/schema";

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log("Fetching revenue data...");
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    // const data = await sql<Revenue>`SELECT * FROM revenue`;
    const data: (typeof revenue.$inferSelect)[] = await db
      .select()
      .from(revenue);
    // console.log("Data fetch completed after 3 seconds.");
    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    // pure SQL version:
    //   const data = await db.execute<LatestInvoiceRaw>(sql`
    //   SELECT
    //     invoices.id,
    //     invoices.amount,
    //     customers.name,
    //     customers.image_url as imageUrl,
    //     customers.email
    //   FROM invoices
    //   INNER JOIN customers ON invoices.customer_id = customers.id
    //   ORDER BY invoices.date DESC
    //   LIMIT 5
    // `);

    const data = await db
      .select({
        id: invoices.id,
        amount: invoices.amount,
        name: customers.name,
        imageUrl: customers.imageUrl,
        email: customers.email,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(invoices.date))
      .limit(5);

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = db.select({ count: count() }).from(invoices);
    const customerCountPromise = db.select({ count: count() }).from(customers);
    const invoiceStatusPromise = db
      .select({
        paid: sql<number>`sum(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amount} ELSE 0 END)`,
        pending: sql<number>`sum(CASE WHEN ${invoices.status} = 'pending' THEN ${invoices.amount} ELSE 0 END)`,
      })
      .from(invoices);

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0][0].count ?? "0");
    const numberOfCustomers = Number(data[1][0].count ?? "0");
    const totalPaidInvoices = formatCurrency(data[2][0].paid ?? "0");
    const totalPendingInvoices = formatCurrency(data[2][0].pending ?? "0");

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoicesData = await db
      .select({
        id: invoices.id,
        amount: invoices.amount,
        date: invoices.date,
        status: invoices.status,
        name: customers.name,
        email: customers.email,
        imageUrl: customers.imageUrl,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        sql`${customers.name} ILIKE ${`%${query}%`} OR
            ${customers.email} ILIKE ${`%${query}%`} OR
            ${invoices.amount}::text ILIKE ${`%${query}%`} OR
            ${invoices.date}::text ILIKE ${`%${query}%`} OR
            ${invoices.status} ILIKE ${`%${query}%`}`
      )
      .orderBy(desc(invoices.date))
      .limit(ITEMS_PER_PAGE)
      .offset(offset);

    return invoicesData;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    //   const count = await sql`SELECT COUNT(*)
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   WHERE
    //     customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`} OR
    //     invoices.amount::text ILIKE ${`%${query}%`} OR
    //     invoices.date::text ILIKE ${`%${query}%`} OR
    //     invoices.status ILIKE ${`%${query}%`}
    // `;
    const countData = await db
      .select({ count: count() })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        sql`${customers.name} ILIKE ${`%${query}%`} OR
        ${customers.email} ILIKE ${`%${query}%`} OR
        ${invoices.amount}::text ILIKE ${`%${query}%`} OR
        ${invoices.date}::text ILIKE ${`%${query}%`} OR
        ${invoices.status} ILIKE ${`%${query}%`}`
      );

    const totalPages = Math.ceil(Number(countData[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    //     const data = await sql<InvoiceForm>`
    //   SELECT
    //     invoices.id,
    //     invoices.customer_id,
    //     invoices.amount,
    //     invoices.status
    //   FROM invoices
    //   WHERE invoices.id = ${id};
    // `;
    const data = await db
      .select({
        id: invoices.id,
        customerId: invoices.customerId,
        amount: invoices.amount,
        status: invoices.status,
      })
      .from(invoices)
      .where(eq(invoices.id, id));

    if (!data.length) return null;

    const invoice = {
      ...data[0],
      // Convert amount from cents to dollars
      amount: data[0].amount / 100,
    };

    return invoice;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    //     const data = await sql<CustomerField>`
    //   SELECT
    //     id,
    //     name
    //   FROM customers
    //   ORDER BY name ASC
    // `;
    const data = await db
      .select({
        id: customers.id,
        name: customers.name,
      })
      .from(customers)
      .orderBy(customers.name);

    return data;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    //     const data = await sql<CustomersTableType>`
    // SELECT
    //   customers.id,
    //   customers.name,
    //   customers.email,
    //   customers.image_url,
    //   COUNT(invoices.id) AS total_invoices,
    //   SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
    //   SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
    // FROM customers
    // LEFT JOIN invoices ON customers.id = invoices.customer_id
    // WHERE
    //   customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`}
    // GROUP BY customers.id, customers.name, customers.email, customers.image_url
    // ORDER BY customers.name ASC
    // `;

    const data = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        imageUrl: customers.imageUrl,
        totalInvoices: count(invoices.id),
        totalPending: sql<number>`SUM(CASE WHEN ${invoices.status} = 'pending' THEN ${invoices.amount} ELSE 0 END)`,
        totalPaid: sql<number>`SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amount} ELSE 0 END)`,
      })
      .from(customers)
      .leftJoin(invoices, eq(customers.id, invoices.customerId))
      .where(
        or(
          ilike(customers.name, `%${query}%`),
          ilike(customers.email, `%${query}%`)
        )
      )
      .groupBy(
        customers.id,
        customers.name,
        customers.email,
        customers.imageUrl
      )
      .orderBy(customers.name);

    const customersData = data.map((customer) => ({
      ...customer,
      totalPending: formatCurrency(customer.totalPending ?? 0),
      totalPaid: formatCurrency(customer.totalPaid ?? 0),
    }));

    return customersData;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
