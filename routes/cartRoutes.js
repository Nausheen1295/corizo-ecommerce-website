
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();

// Helper: wait for the session to be written to the store
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => (error ? reject(error) : resolve()));
  });
}

// Helper: calculate cart totals using current database prices.
// Products that were deactivated or deleted are dropped from the cart.
async function getCartDetails(cart) {
  const products = await Product.find({
    _id: { $in: cart.map(entry => entry.productId) },
    isActive: true
  });

  const items = [];
  const validCart = [];
  let total = 0;

  for (const entry of cart) {
    const product = products.find(p => p._id.toString() === entry.productId);

    if (!product) continue;

    const quantity = Number(entry.quantity);
    const subtotal = product.price * quantity;

    items.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity,
      subtotal,
      stock: product.stock
    });

    validCart.push(entry);
    total += subtotal;
  }

  return {
    items,
    total,
    validCart,
    removedCount: cart.length - validCart.length
  };
}

// Helper: save the cleaned-up cart and send it back to the browser
async function sendCart(req, res, message) {
  const { items, total, validCart, removedCount } = await getCartDetails(
    req.session.cart || []
  );

  req.session.cart = validCart;
  await saveSession(req);

  const notice = removedCount
    ? "Some items are no longer available and were removed from your cart."
    : undefined;

  res.json({ message, notice, items, total });
}

// Get the logged-in user's cart
router.get("/", requireLogin, async (req, res) => {
  try {
    await sendCart(req, res);
  } catch (error) {
    console.error("Get cart error:", error.message);
    res.status(500).json({ message: "Could not load your cart." });
  }
});

// Add a product to the cart
router.post("/items", requireLogin, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const amount = Number(quantity);

    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(amount) ||
      amount < 1
    ) {
      return res.status(400).json({
        message: "Provide a valid product ID and quantity."
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const cart = req.session.cart || [];
    const existing = cart.find(item => item.productId === productId);
    const currentQuantity = existing ? existing.quantity : 0;

    if (currentQuantity + amount > product.stock) {
      return res.status(400).json({
        message: product.stock === 0
          ? "This product is out of stock."
          : `Only ${product.stock} left in stock.`
      });
    }

    if (existing) {
      existing.quantity += amount;
    } else {
      cart.push({ productId, quantity: amount });
    }

    req.session.cart = cart;
    await sendCart(req, res, "Cart updated successfully.");
  } catch (error) {
    console.error("Add to cart error:", error.message);
    res.status(500).json({ message: "Could not add the product to your cart." });
  }
});

// Change the quantity of a cart item
router.patch("/items/:productId", requireLogin, async (req, res) => {
  try {
    const { productId } = req.params;
    const quantity = Number(req.body.quantity);

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number."
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} left in stock.`
      });
    }

    const cart = req.session.cart || [];
    const item = cart.find(entry => entry.productId === productId);

    if (!item) {
      return res.status(404).json({ message: "Item not found in your cart." });
    }

    item.quantity = quantity;
    req.session.cart = cart;
    await sendCart(req, res, "Cart quantity updated.");
  } catch (error) {
    console.error("Update cart error:", error.message);
    res.status(500).json({ message: "Could not update your cart." });
  }
});

// Remove an item from the cart
router.delete("/items/:productId", requireLogin, async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const cart = req.session.cart || [];
    req.session.cart = cart.filter(item => item.productId !== productId);
    await sendCart(req, res, "Item removed from cart.");
  } catch (error) {
    console.error("Remove cart item error:", error.message);
    res.status(500).json({ message: "Could not remove the item." });
  }
});

module.exports = router;
