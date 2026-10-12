
const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Make user text safe to use inside a MongoDB regex
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Check product fields sent by the admin panel.
// For updates (partial = true) only the fields that were sent are checked.
function validateProduct(body, partial = false) {
  const product = {};

  for (const field of ["name", "description", "category", "imageUrl"]) {
    if (body[field] === undefined) continue;

    if (typeof body[field] !== "string") {
      return { error: `${field} must be text.` };
    }

    product[field] = body[field].trim();
  }

  for (const field of ["name", "description", "category"]) {
    if ((!partial || body[field] !== undefined) && !product[field]) {
      return { error: `Product ${field} is required.` };
    }
  }

  if (product.imageUrl && !/^(https?:\/\/|\/)/.test(product.imageUrl)) {
    return { error: "Image URL must start with http://, https:// or /." };
  }

  if (body.price !== undefined) {
    const price = body.price === "" || body.price === null
      ? NaN
      : Number(body.price);

    if (!Number.isFinite(price) || price < 0) {
      return { error: "Price must be a valid non-negative number." };
    }

    product.price = price;
  } else if (!partial) {
    return { error: "Product price is required." };
  }

  if (body.stock !== undefined) {
    const stock = body.stock === "" || body.stock === null
      ? NaN
      : Number(body.stock);

    if (!Number.isInteger(stock) || stock < 0) {
      return { error: "Stock must be a whole number of 0 or more." };
    }

    product.stock = stock;
  } else if (!partial) {
    product.stock = 0;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { error: "isActive must be true or false." };
    }

    product.isActive = body.isActive;
  }

  return { product };
}

// Get all active products, with optional search and category filters
router.get("/", async (req, res) => {
  try {
    const filter = { isActive: true };

    if (typeof req.query.category === "string" && req.query.category) {
      filter.category = req.query.category;
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.name = {
        $regex: escapeRegex(req.query.search.trim()),
        $options: "i"
      };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("Get products error:", error.message);
    res.status(500).json({ message: "Could not load products." });
  }
});

// Admin: get every product, including deactivated ones
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error("Admin products error:", error.message);
    res.status(500).json({ message: "Could not load products." });
  }
});

// Get one product by ID
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Could not load the product." });
  }
});

// Admin: create a product
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { product: fields, error } = validateProduct(req.body);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const product = await Product.create(fields);

    res.status(201).json({
      message: "Product created successfully.",
      product
    });
  } catch (error) {
    console.error("Create product error:", error.message);
    res.status(500).json({ message: "Could not create the product." });
  }
});

// Admin: update a product
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const { product: updates, error } = validateProduct(req.body, true);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { returnDocument: "after", runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ message: "Product updated successfully.", product });
  } catch (error) {
    console.error("Update product error:", error.message);
    res.status(500).json({ message: "Could not update the product." });
  }
});

// Admin: deactivate a product without permanently deleting it
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { returnDocument: "after" }
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ message: "Product deactivated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Could not deactivate the product." });
  }
});

module.exports = router;
