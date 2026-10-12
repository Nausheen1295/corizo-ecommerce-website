# Corizo Store

A simple e-commerce website built with HTML, Bootstrap, Node.js, Express and MongoDB.

## Features

- Browse, search and filter products
- Register, log in and log out (session based)
- Shopping cart with stock checks
- Cash-on-delivery checkout and order history
- Admin dashboard: manage products, update order status, view customers

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create a `.env` file in the project folder:

   ```
   MONGO_URI=your-mongodb-connection-string
   SESSION_SECRET=a-long-random-string
   PORT=5000
   NODE_ENV=development
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=at-least-12-characters
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

   The Cloudinary keys are needed for product image uploads in the admin panel.
   Get them free at https://cloudinary.com (Dashboard → API Keys).

3. Create the admin account (run once):

   ```
   npm run create-admin
   ```

4. Add sample products (optional, only runs when the store is empty):

   ```
   npm run seed
   ```

5. Start the server:

   ```
   npm run dev
   ```

   Then open http://localhost:5000

## Testing

```
npm test
```

Runs the whole shopping flow (register, login, cart, checkout, admin order
management) against a temporary database that is deleted afterwards.

## Deploying on Render

1. In MongoDB Atlas, go to **Network Access** and allow `0.0.0.0/0`
   (Render does not use a fixed IP address).
2. Push this project to GitHub.
3. On https://render.com choose **New → Blueprint**, pick the repository,
   and Render reads `render.yaml`.
4. Fill in `MONGO_URI` and the three `CLOUDINARY_` values when asked.
   `SESSION_SECRET` is generated automatically.
5. After the first deploy, create the admin account by running this on your
   computer (it uses the same database):

   ```
   npm run create-admin
   ```

The free plan sleeps after 15 minutes without visitors, so the first page
load after a break can take up to a minute.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home page and product list |
| `login.html` / `register.html` | Customer accounts |
| `cart.html` | View and edit the cart |
| `checkout.html` | Enter address and place a COD order |
| `myorders.html` | Customer order history |
| `admin.html` | Admin dashboard |

## API

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Public |
| GET | `/api/auth/me` | Public |
| GET | `/api/products` | Public |
| GET | `/api/products/:id` | Public |
| GET | `/api/products/admin/all` | Admin |
| POST / PATCH / DELETE | `/api/products`, `/api/products/:id` | Admin |
| GET | `/api/cart` | Logged in |
| POST | `/api/cart/items` | Logged in |
| PATCH / DELETE | `/api/cart/items/:productId` | Logged in |
| POST | `/api/orders/checkout` | Logged in |
| GET | `/api/orders/my-orders` | Logged in |
| GET | `/api/orders/admin/all` | Admin |
| PATCH | `/api/orders/admin/:id/status` | Admin |
| GET | `/api/orders/admin/customers` | Admin |
| POST | `/api/uploads/image` | Admin |
