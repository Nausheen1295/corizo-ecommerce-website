// Shared helpers used by every Tech World page.
// Each page needs <nav id="siteNav"> and <div id="statusMessage"> in its HTML.

const CURRENCY = "₹";

let currentUser = null;

// Call the API and turn error responses into thrown errors
async function api(url, options = {}) {
  // File uploads (FormData) set their own Content-Type
  const isJson = options.body && !(options.body instanceof FormData);

  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(isJson ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "The request failed.");
  }

  return data;
}

// Always escape text from the database before putting it into innerHTML
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatPrice(value) {
  return CURRENCY + Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function showMessage(message, type = "info") {
  const box = document.getElementById("statusMessage");
  if (!box) return;

  box.textContent = message;
  box.className = "alert alert-" + type;
  box.style.display = "block";
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideMessage() {
  const box = document.getElementById("statusMessage");
  if (box) box.style.display = "none";
}

// Only allow redirects to pages on this site (stops "?next=https://evil.com")
function safeNextPage(fallback = "/") {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

async function loadCurrentUser() {
  try {
    const result = await api("/api/auth/me");
    currentUser = result.loggedIn ? result.user : null;
  } catch {
    currentUser = null;
  }

  return currentUser;
}

async function updateCartCount() {
  const counter = document.getElementById("cartCount");
  if (!counter || !currentUser) return;

  try {
    const cart = await api("/api/cart");
    counter.textContent = cart.items.reduce(
      (sum, item) => sum + Number(item.quantity), 0
    );
  } catch {
    counter.textContent = "0";
  }
}

function renderNavbar() {
  const nav = document.getElementById("siteNav");
  if (!nav) return;

  const links = currentUser
    ? `
      <a href="/cart.html" class="btn btn-outline-dark">
        Cart (<span id="cartCount">0</span>)
      </a>
      <a href="/myorders.html" class="btn btn-light">My orders</a>
      ${currentUser.role === "admin"
        ? '<a href="/admin.html" class="btn btn-light">Admin</a>'
        : ""}
      <span class="text-secondary small px-1">Hi, ${escapeHtml(currentUser.name)}</span>
      <button id="logoutButton" class="btn btn-brand">Log out</button>`
    : `
      <a href="/login.html" class="btn btn-light">Log in</a>
      <a href="/register.html" class="btn btn-brand">Register</a>`;

  nav.className = "navbar sticky-top";
  nav.innerHTML = `
    <div class="container py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
      <a class="brand" href="/">Tech World</a>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <a href="/#products" class="btn btn-light">Shop</a>
        ${links}
      </div>
    </div>`;

  const logoutButton = document.getElementById("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        await api("/api/auth/logout", { method: "POST" });
      } finally {
        window.location.href = "/";
      }
    });
  }
}

// Run at the start of every page.
// Pages that need a login send logged-out visitors to the login page.
async function initPage({ requireLogin = false, requireAdmin = false } = {}) {
  await loadCurrentUser();

  if ((requireLogin || requireAdmin) && !currentUser) {
    const here = window.location.pathname + window.location.search;
    window.location.href = "/login.html?next=" + encodeURIComponent(here);
    return null;
  }

  if (requireAdmin && currentUser.role !== "admin") {
    window.location.href = "/";
    return null;
  }

  renderNavbar();
  updateCartCount();
  return currentUser;
}
