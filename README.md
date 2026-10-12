# Corizo Store

**Live website:** https://corizo-store.onrender.com

Corizo Store is a full-stack e-commerce website for electronics: phones, laptops,
tablets, wearables and accessories. Customers can browse products, manage a
shopping cart and place cash-on-delivery orders. Store administrators manage
products, stock, orders and customers from a dashboard.

> The site is hosted on Render's free plan. If it has been idle, the first page
> load can take up to a minute while the server wakes up.

## Features

### For customers
- Browse the product catalogue with live search and category filters
- Create an account, log in and log out securely
- Add products to the cart, change quantities and remove items
- See stock availability and cart totals update instantly
- Check out with a shipping address and pay by cash on delivery
- View order history with order status and payment status

### For administrators
- Dashboard with active products, total orders, orders to process and revenue
- Add, edit, hide and restore products
- Upload product images straight from the dashboard
- Update order status (Pending → Confirmed → Shipped → Delivered, or Cancelled)
- Stock is returned automatically when an order is cancelled
- View all registered customers

### Security
- Passwords are hashed with bcrypt and never stored in plain text
- Login sessions are stored in the database with secure, HTTP-only cookies
- Admin pages and actions are protected on the server
- Prices and stock are always checked on the server, never trusted from the browser

## Tools and technologies

| Area | Tools |
|---|---|
| Frontend | HTML5, CSS3, JavaScript, Bootstrap 5 |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | express-session, connect-mongo, bcryptjs |
| Image uploads | Cloudinary, Multer |
| Testing | Automated end-to-end test of the full shopping flow (Node.js) |
| Version control | Git, GitHub |
| Hosting | Render |
| Code editor | Visual Studio Code |

## Pages

| Page | Description |
|---|---|
| Home | Product catalogue with search and filters |
| Register / Log in | Customer accounts |
| Cart | Review items, change quantities and see totals |
| Checkout | Shipping details and cash-on-delivery order |
| My orders | Order history and status tracking |
| Admin dashboard | Manage products, orders and customers |

## Project structure

```
├── models/        Database schemas (User, Product, Order)
├── routes/        API routes (auth, products, cart, orders, uploads)
├── middleware/    Login and admin access checks
├── public/        Website pages, styles, scripts and product images
├── test/          End-to-end shopping flow test
├── server.js      Express server
└── seed.js        Loads the starting product catalogue
```

---

Student e-commerce project.
