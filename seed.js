
require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const Product = require("./models/Product");

// Starting catalogue using the photos in public/images.
// Prices and stock are estimates — change them any time in the admin panel.
const sampleProducts = [
  // Phones
  {
    name: "Apple iPhone 17 Pro Max",
    description: "Apple's flagship phone with a large Super Retina display, pro camera system and all-day battery life.",
    price: 149900, category: "Phones", stock: 8, imageUrl: "/images/iphone17promax.jpg"
  },
  {
    name: "Apple iPhone Duo",
    description: "Two-tone iPhone with a bright OLED display, dual cameras and fast performance for everyday use.",
    price: 79900, category: "Phones", stock: 10, imageUrl: "/images/iphoneduo.jpg"
  },
  {
    name: "Samsung Galaxy Z Fold8",
    description: "Foldable smartphone that opens into a tablet-sized screen for multitasking, reading and entertainment.",
    price: 164999, category: "Phones", stock: 5, imageUrl: "/images/samsunggalaxyzfold8.jpg"
  },
  {
    name: "Samsung Galaxy A06",
    description: "Affordable Samsung phone with a big display, long-lasting battery and dependable cameras.",
    price: 9999, category: "Phones", stock: 30, imageUrl: "/images/samsunggalaxya06.jpg"
  },
  {
    name: "Xiaomi Redmi Note 15",
    description: "Feature-packed mid-range phone with an AMOLED display, fast charging and a high-resolution camera.",
    price: 18999, category: "Phones", stock: 20, imageUrl: "/images/xiaomiredminote15.jpg"
  },
  {
    name: "Honor Robot Phone",
    description: "Innovative Honor smartphone with an AI-powered camera and a sleek modern design.",
    price: 54999, category: "Phones", stock: 6, imageUrl: "/images/honorrobotphone.jpg"
  },

  // Laptops
  {
    name: "Asus Vivobook 15",
    description: "Lightweight 15.6-inch laptop for study and work, with a full-size keyboard and fast SSD storage.",
    price: 45990, category: "Laptops", stock: 10, imageUrl: "/images/asusvivobook15.jpg"
  },
  {
    name: "Dell Laptop",
    description: "Reliable Dell laptop with a comfortable keyboard, sharp display and solid everyday performance.",
    price: 52990, category: "Laptops", stock: 8, imageUrl: "/images/delllaptop.jpg"
  },
  {
    name: "HP EliteBook",
    description: "Premium business laptop with a durable build, strong security features and long battery life.",
    price: 89990, category: "Laptops", stock: 5, imageUrl: "/images/hpelitebook.jpg"
  },
  {
    name: "HP Laptop",
    description: "Everyday HP laptop for browsing, streaming and assignments, with a crisp display and fast boot-up.",
    price: 39990, category: "Laptops", stock: 12, imageUrl: "/images/hplaptop.jpg"
  },

  // Tablets
  {
    name: "Apple iPad 11",
    description: "11-inch iPad with a Liquid Retina display, ideal for notes, drawing, streaming and learning.",
    price: 34900, category: "Tablets", stock: 10, imageUrl: "/images/appleipad11.jpg"
  },
  {
    name: "Samsung Galaxy Tab A11",
    description: "Family-friendly Android tablet with a large screen, stereo speakers and long battery life.",
    price: 14999, category: "Tablets", stock: 15, imageUrl: "/images/samsungglaxytaba11.jpg"
  },
  {
    name: "Huawei MatePad Tablet",
    description: "Slim tablet with a vivid display and smooth performance for work and entertainment on the go.",
    price: 24999, category: "Tablets", stock: 8, imageUrl: "/images/huaweimatepadtablet.jpg"
  },

  // Wearables
  {
    name: "Honor Choice Watch",
    description: "Smartwatch with an AMOLED display, health tracking, GPS and up to two weeks of battery life.",
    price: 5999, category: "Wearables", stock: 20, imageUrl: "/images/honorchoicewatch.webp"
  },
  {
    name: "Huawei Band 10",
    description: "Slim fitness band that tracks heart rate, sleep, steps and workouts with a bright colour screen.",
    price: 3999, category: "Wearables", stock: 25, imageUrl: "/images/huaweiband10.webp"
  },
  {
    name: "Xiaomi Redmi Watch 5",
    description: "Large-screen smartwatch with Bluetooth calling, 150+ sports modes and long battery life.",
    price: 4999, category: "Wearables", stock: 25, imageUrl: "/images/xiaomiredmiwatch5.webp"
  },

  // Accessories
  {
    name: "Logitech Wireless Mouse",
    description: "Comfortable wireless mouse with precise tracking and a long-lasting battery.",
    price: 899, category: "Accessories", stock: 40, imageUrl: "/images/logitechmouse.jpg"
  },
  {
    name: "Laptop Stand",
    description: "Adjustable aluminium laptop stand that raises your screen to eye level for better posture.",
    price: 1299, category: "Accessories", stock: 30, imageUrl: "/images/laptopstand.jpg"
  },
  {
    name: "USB-C Docking Station",
    description: "Connect monitors, USB drives, Ethernet and chargers to your laptop through a single USB-C port.",
    price: 3499, category: "Accessories", stock: 15, imageUrl: "/images/dockingstation.jpg"
  },
  {
    name: "Fast Charging Adapter",
    description: "Compact fast-charging wall adapter for phones, tablets and other USB devices.",
    price: 999, category: "Accessories", stock: 50, imageUrl: "/images/adapter.jpg"
  },
  {
    name: "USB Type-C Cable",
    description: "Durable braided USB-C cable for fast charging and data transfer.",
    price: 399, category: "Accessories", stock: 60, imageUrl: "/images/typeccable.jpg"
  }
];

async function seed() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const existing = await Product.countDocuments();

    if (existing > 0) {
      console.log(`Skipped: the store already has ${existing} products.`);
      return;
    }

    await Product.insertMany(sampleProducts);

    console.log(`Added ${sampleProducts.length} products.`);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

seed();
