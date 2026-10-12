
const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Keep the file in memory; it goes straight to Cloudinary, never to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(null, ALLOWED_TYPES.includes(file.mimetype));
  }
});

// Helper: send an image buffer to Cloudinary
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: "corizo-store/products",
        resource_type: "image",
        // Shrink large photos so product pages load quickly
        transformation: [{ width: 1000, height: 1000, crop: "limit" }]
      },
      (error, result) => (error ? reject(error) : resolve(result))
    ).end(buffer);
  });
}

// Admin: upload a product image and get back its URL
router.post("/image", requireAdmin, (req, res) => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return res.status(500).json({
      message: "Image uploads are not set up. Add the Cloudinary keys to .env."
    });
  }

  upload.single("image")(req, res, async uploadError => {
    if (uploadError) {
      return res.status(400).json({
        message: uploadError.code === "LIMIT_FILE_SIZE"
          ? `Image must be smaller than ${MAX_SIZE_MB} MB.`
          : "Could not read the uploaded file."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please choose a JPG, PNG, WebP or GIF image."
      });
    }

    try {
      const result = await uploadToCloudinary(req.file.buffer);
      res.status(201).json({ imageUrl: result.secure_url });
    } catch (error) {
      console.error("Image upload error:", error.message);
      res.status(500).json({ message: "Could not upload the image. Please try again." });
    }
  });
});

module.exports = router;
