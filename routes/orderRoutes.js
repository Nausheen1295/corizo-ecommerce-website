
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { requireLogin, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const ORDER_STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

// Orders in these states can no longer be changed
const FINAL_STATUSES = ["Delivered", "Cancelled"];

// Helper: an error whose message is safe to show to the customer
function customerError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

// Helper: check the shipping address and keep only the fields we store
function cleanShippingAddress(address) {
  if (!address || typeof address !== "object") {
    return { error: "Please provide your shipping address." };
  }

  const clean = {};

  for (const field of ["fullName", "phone", "addressLine", "city", "postalCode"]) {
    const value = address[field] === undefined ? "" : address[field];

    if (typeof value !== "string") {
      return { error: "Shipping address fields must be text." };
    }

    clean[field] = value.trim();
  }

  if (!clean.fullName || !clean.addressLine || !clean.city || !clean.phone) {
    return { error: "Please provide your name, address, city, and phone." };
  }

  if (!/^[0-9+\-\s()]{7,20}$/.test(clean.phone)) {
    return { error: "Please enter a valid phone number." };
  }

  return { address: clean };
}

// Customer: place a cash-on-delivery order
router.post("/checkout", requireLogin, async (req, res) => {
  const reservedItems = [];

  try {
    const cart = req.session.cart || [];

    if (!cart.length) {
      return res.status(400).json({ message: "Your cart is empty." });
    }

    const { address, error } = cleanShippingAddress(req.body.shippingAddress);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const items = [];
    let totalAmount = 0;

    for (const entry of cart) {
      if (!mongoose.isValidObjectId(entry.productId)) {
        throw customerError("Your cart contains an invalid product.");
      }

      // Reserve stock only if enough is available
      const product = await Product.findOneAndUpdate(
        {
          _id: entry.productId,
          isActive: true,
          stock: { $gte: entry.quantity }
        },
        { $inc: { stock: -entry.quantity } },
        { returnDocument: "after" }
      );

      if (!product) {
        const current = await Product.findById(entry.productId);

        throw customerError(
          current && current.isActive
            ? `Only ${current.stock} of "${current.name}" left in stock. Please update your cart.`
            : "A product in your cart is no longer available. Please review your cart."
        );
      }

      reservedItems.push({
        productId: product._id,
        quantity: entry.quantity
      });

      const subtotal = product.price * entry.quantity;
      totalAmount += subtotal;

      items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: entry.quantity
      });
    }

    const order = await Order.create({
      user: req.session.user.id,
      items,
      totalAmount,
      shippingAddress: address,
      paymentMethod: "COD",
      paymentStatus: "Pending",
      status: "Pending"
    });

    req.session.cart = [];

    await new Promise((resolve, reject) => {
      req.session.save(error => error ? reject(error) : resolve());
    });

    res.status(201).json({
      message: "Order placed successfully.",
      order
    });
  } catch (error) {
    // Return reserved stock if checkout fails
    for (const item of reservedItems) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity } }
      ).catch(() => {});
    }

    console.error("Checkout error:", error.message);
    res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Could not place your order. Please try again."
    });
  }
});

// Customer: view their own orders
router.get("/my-orders", requireLogin, async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.session.user.id
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Could not load your orders." });
  }
});

// Admin: view all orders
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Could not load orders." });
  }
});

// Admin: update an order's status
router.patch("/admin/:id/status", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid order ID." });
    }

    const { status } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid order status." });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (FINAL_STATUSES.includes(order.status)) {
      return res.status(400).json({
        message: `This order is already ${order.status.toLowerCase()} and cannot be changed.`
      });
    }

    // Put the stock back when an order is cancelled
    if (status === "Cancelled") {
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    order.status = status;

    if (status === "Delivered") {
      order.paymentStatus = "Paid";
    }

    await order.save();

    res.json({ message: "Order status updated.", order });
  } catch (error) {
    console.error("Update order error:", error.message);
    res.status(500).json({ message: "Could not update order status." });
  }
});

// Admin: list customer accounts
router.get("/admin/customers", requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("name email phone createdAt")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Could not load customers." });
  }
});

module.exports = router;
