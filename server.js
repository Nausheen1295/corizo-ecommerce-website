
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const dns = require("dns");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

// Load database and session settings from .env
dotenv.config();

// The session store below needs these at startup, so check them first
if (!process.env.MONGO_URI || !process.env.SESSION_SECRET) {
  console.error("MONGO_URI and SESSION_SECRET must be configured in .env");
  process.exit(1);
}

// Local DNS workaround for development only
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const app = express();

// Needed for secure cookies when hosted behind a proxy (Render, Railway, etc.)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Import database models
require("./models/User");
require("./models/Product");
require("./models/Order");

// Import API routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

// Parse incoming request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files from public/
app.use(express.static(path.join(__dirname, "public")));

// Session middleware MUST be registered before API routes
app.use(
  session({
    name: "corizo.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions"
    }),

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/uploads", uploadRoutes);


// API health check
app.get("/api/test", (req, res) => {
  res.json({
    message: "E-commerce API is working!"
  });
});

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle requests to unknown API endpoints
app.use("/api", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found."
  });
});

// General error handler
app.use((err, req, res, next) => {
  console.error("Application error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

const PORT = process.env.PORT || 5000;

// Start server only after MongoDB connects
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(
        `E-commerce server running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();

