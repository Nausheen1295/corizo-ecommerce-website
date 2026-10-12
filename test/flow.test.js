
// End-to-end test of the full shopping flow.
// Runs the real server against a temporary test database, then deletes it.
// Usage: npm test

require("dotenv").config({ quiet: true });

const { spawn } = require("child_process");
const path = require("path");
const dns = require("dns");
const assert = require("assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const PORT = 5099;
const BASE = `http://localhost:${PORT}`;

// Same cluster, different database name, so real data is never touched
const testDbName = "corizo_test_" + Date.now();
const testUri = new URL(process.env.MONGO_URI);
testUri.pathname = "/" + testDbName;
const TEST_MONGO_URI = testUri.toString();

let server;
let passed = 0;

// A tiny HTTP client that remembers its session cookie, like a browser
function createClient() {
  let cookie = "";

  return async function request(method, url, body) {
    const response = await fetch(BASE + url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const setCookie = response.headers.getSetCookie();
    if (setCookie.length) {
      cookie = setCookie.map(c => c.split(";")[0]).join("; ");
    }

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  };
}

async function step(name, fn) {
  await fn();
  passed++;
  console.log("  ✓ " + name);
}

async function startServer() {
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      MONGO_URI: TEST_MONGO_URI,
      PORT: String(PORT),
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  server.stdout.on("data", chunk => (output += chunk));
  server.stderr.on("data", chunk => (output += chunk));

  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(BASE + "/api/test");
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error("Server did not start:\n" + output);
}

async function run() {
  console.log(`Using temporary database "${testDbName}"\n`);

  await mongoose.connect(TEST_MONGO_URI);

  // The admin account is created directly, just like createAdmin.js does
  const User = require("../models/User");
  await User.create({
    name: "Test Admin",
    email: "admin@test.local",
    passwordHash: await bcrypt.hash("admin-password-123", 4),
    role: "admin"
  });

  await startServer();

  const guest = createClient();
  const customer = createClient();
  const admin = createClient();
  let productA;
  let productB;
  let firstOrder;

  console.log("Phase 3 — Registration and login");

  await step("API health check works", async () => {
    const res = await guest("GET", "/api/test");
    assert.equal(res.status, 200);
  });

  await step("register rejects an invalid email", async () => {
    const res = await guest("POST", "/api/auth/register", {
      name: "Asha", email: "not-an-email", password: "password123"
    });
    assert.equal(res.status, 400);
  });

  await step("register rejects a short password", async () => {
    const res = await guest("POST", "/api/auth/register", {
      name: "Asha", email: "asha@test.local", password: "short"
    });
    assert.equal(res.status, 400);
  });

  await step("customer can register", async () => {
    const res = await guest("POST", "/api/auth/register", {
      name: "Asha Customer", email: "Asha@Test.local", password: "password123", phone: "9876543210"
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, "user");
    assert.equal(res.data.user.email, "asha@test.local");
  });

  await step("registering the same email twice is blocked", async () => {
    const res = await guest("POST", "/api/auth/register", {
      name: "Asha Again", email: "asha@test.local", password: "password123"
    });
    assert.equal(res.status, 409);
  });

  await step("register cannot create an admin", async () => {
    const res = await guest("POST", "/api/auth/register", {
      name: "Sneaky", email: "sneaky@test.local", password: "password123", role: "admin"
    });
    assert.equal(res.data.user.role, "user");
  });

  await step("login fails with the wrong password", async () => {
    const res = await customer("POST", "/api/auth/login", {
      email: "asha@test.local", password: "wrong-password"
    });
    assert.equal(res.status, 401);
  });

  await step("customer can log in and the session is remembered", async () => {
    const login = await customer("POST", "/api/auth/login", {
      email: "asha@test.local", password: "password123"
    });
    assert.equal(login.status, 200);

    const me = await customer("GET", "/api/auth/me");
    assert.equal(me.data.loggedIn, true);
    assert.equal(me.data.user.name, "Asha Customer");
  });

  await step("admin can log in", async () => {
    const res = await admin("POST", "/api/auth/login", {
      email: "admin@test.local", password: "admin-password-123"
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, "admin");
  });

  console.log("\nPhase 6 — Admin product management");

  await step("customers cannot create products", async () => {
    const res = await customer("POST", "/api/products", {
      name: "Hack", description: "x", category: "x", price: 1
    });
    assert.equal(res.status, 403);
  });

  await step("admin product form is validated", async () => {
    const res = await admin("POST", "/api/products", {
      name: "No price", description: "Missing price", category: "Test"
    });
    assert.equal(res.status, 400);
  });

  await step("admin can create products", async () => {
    const a = await admin("POST", "/api/products", {
      name: "Test Earbuds", description: "Wireless earbuds", category: "Electronics",
      price: 1500, stock: 5, imageUrl: "https://placehold.co/600x600"
    });
    const b = await admin("POST", "/api/products", {
      name: "Test Mug", description: "Ceramic mug", category: "Kitchen",
      price: 250, stock: 1
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    productA = a.data.product;
    productB = b.data.product;
  });

  await step("products appear in the public list, search and filter", async () => {
    const all = await guest("GET", "/api/products");
    assert.equal(all.data.length, 2);

    const search = await guest("GET", "/api/products?search=earbud");
    assert.equal(search.data.length, 1);

    const category = await guest("GET", "/api/products?category=Kitchen");
    assert.equal(category.data[0].name, "Test Mug");

    const weird = await guest("GET", "/api/products?search=(");
    assert.equal(weird.status, 200);
  });

  console.log("\nPhase 4 — Shopping cart");

  await step("guests cannot use the cart", async () => {
    const res = await guest("POST", "/api/cart/items", { productId: productA._id });
    assert.equal(res.status, 401);
  });

  await step("customer can add items", async () => {
    const res = await customer("POST", "/api/cart/items", { productId: productA._id, quantity: 2 });
    assert.equal(res.status, 200);
    assert.equal(res.data.items[0].quantity, 2);
    assert.equal(res.data.total, 3000);
  });

  await step("cannot add more than the stock", async () => {
    const res = await customer("POST", "/api/cart/items", { productId: productA._id, quantity: 10 });
    assert.equal(res.status, 400);
  });

  await step("customer can change quantity", async () => {
    const res = await customer("PATCH", `/api/cart/items/${productA._id}`, { quantity: 3 });
    assert.equal(res.status, 200);
    assert.equal(res.data.total, 4500);
  });

  await step("customer can remove items and totals update", async () => {
    await customer("POST", "/api/cart/items", { productId: productB._id });
    const withB = await customer("GET", "/api/cart");
    assert.equal(withB.data.total, 4750);

    const res = await customer("DELETE", `/api/cart/items/${productB._id}`);
    assert.equal(res.data.items.length, 1);
    assert.equal(res.data.total, 4500);
  });

  console.log("\nPhase 5 — Checkout and orders");

  await step("checkout requires a shipping address", async () => {
    const res = await customer("POST", "/api/orders/checkout", {
      shippingAddress: { fullName: "Asha" }
    });
    assert.equal(res.status, 400);
  });

  await step("customer can place a cash-on-delivery order", async () => {
    const res = await customer("POST", "/api/orders/checkout", {
      shippingAddress: {
        fullName: "Asha Customer", phone: "9876543210",
        addressLine: "12 MG Road", city: "Bengaluru", postalCode: "560001"
      }
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.order.totalAmount, 4500);
    assert.equal(res.data.order.paymentMethod, "COD");
    firstOrder = res.data.order;
  });

  await step("cart is emptied and stock is reduced", async () => {
    const cart = await customer("GET", "/api/cart");
    assert.equal(cart.data.items.length, 0);

    const product = await guest("GET", `/api/products/${productA._id}`);
    assert.equal(product.data.stock, 2);
  });

  await step("customer sees the order in their history", async () => {
    const res = await customer("GET", "/api/orders/my-orders");
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].status, "Pending");
  });

  await step("checkout fails cleanly when stock runs out", async () => {
    await customer("POST", "/api/cart/items", { productId: productB._id });
    await admin("PATCH", `/api/products/${productB._id}`, { stock: 0 });

    const res = await customer("POST", "/api/orders/checkout", {
      shippingAddress: { fullName: "Asha", phone: "9876543210", addressLine: "12 MG Road", city: "Bengaluru" }
    });
    assert.equal(res.status, 400);
    assert.match(res.data.message, /left in stock/);

    await customer("DELETE", `/api/cart/items/${productB._id}`);
  });

  console.log("\nPhase 6 — Admin orders and customers");

  await step("customers cannot see all orders", async () => {
    const res = await customer("GET", "/api/orders/admin/all");
    assert.equal(res.status, 403);
  });

  await step("admin sees all orders with customer details", async () => {
    const res = await admin("GET", "/api/orders/admin/all");
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].user.email, "asha@test.local");
  });

  await step("admin can move an order to Shipped then Delivered", async () => {
    const shipped = await admin("PATCH", `/api/orders/admin/${firstOrder._id}/status`, { status: "Shipped" });
    assert.equal(shipped.data.order.status, "Shipped");

    const delivered = await admin("PATCH", `/api/orders/admin/${firstOrder._id}/status`, { status: "Delivered" });
    assert.equal(delivered.data.order.paymentStatus, "Paid");
  });

  await step("delivered orders cannot be changed", async () => {
    const res = await admin("PATCH", `/api/orders/admin/${firstOrder._id}/status`, { status: "Cancelled" });
    assert.equal(res.status, 400);
  });

  await step("cancelling an order returns its stock", async () => {
    await customer("POST", "/api/cart/items", { productId: productA._id, quantity: 2 });
    const order = await customer("POST", "/api/orders/checkout", {
      shippingAddress: { fullName: "Asha", phone: "9876543210", addressLine: "12 MG Road", city: "Bengaluru" }
    });
    assert.equal(order.status, 201);

    let product = await guest("GET", `/api/products/${productA._id}`);
    assert.equal(product.data.stock, 0);

    await admin("PATCH", `/api/orders/admin/${order.data.order._id}/status`, { status: "Cancelled" });

    product = await guest("GET", `/api/products/${productA._id}`);
    assert.equal(product.data.stock, 2);
  });

  await step("hidden products leave the store and the cart", async () => {
    await customer("POST", "/api/cart/items", { productId: productA._id });
    await admin("DELETE", `/api/products/${productA._id}`);

    const list = await guest("GET", "/api/products");
    assert.ok(!list.data.some(p => p._id === productA._id));

    const adminList = await admin("GET", "/api/products/admin/all");
    assert.ok(adminList.data.some(p => p._id === productA._id && !p.isActive));

    const cart = await customer("GET", "/api/cart");
    assert.equal(cart.data.items.length, 0);
    assert.ok(cart.data.notice);
  });

  await step("admin can see the customer list", async () => {
    const res = await admin("GET", "/api/orders/admin/customers");
    assert.ok(res.data.some(u => u.email === "asha@test.local"));
    assert.ok(!res.data.some(u => u.email === "admin@test.local"));
  });

  await step("only admins can upload images", async () => {
    const res = await customer("POST", "/api/uploads/image");
    assert.equal(res.status, 403);
  });

  await step("logout ends the session", async () => {
    await customer("POST", "/api/auth/logout");
    const me = await customer("GET", "/api/auth/me");
    assert.equal(me.data.loggedIn, false);
  });

  console.log("\nPages");

  await step("every page loads", async () => {
    const pages = [
      "/", "/login.html", "/register.html", "/cart.html", "/checkout.html",
      "/myorders.html", "/admin.html", "/products.html", "/common.js", "/style.css"
    ];

    for (const page of pages) {
      const response = await fetch(BASE + page);
      assert.equal(response.status, 200, page);
    }
  });
}

async function cleanup() {
  if (server) server.kill();

  if (mongoose.connection.readyState === 1) {
    // Safety check: only ever drop the temporary test database
    if (mongoose.connection.name.startsWith("corizo_test_")) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  }
}

run()
  .then(() => console.log(`\nAll ${passed} checks passed.`))
  .catch(error => {
    console.error("\n✗ Test failed after " + passed + " passing checks:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
