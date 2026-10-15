function showPhone() {
  alert("Телефон для замовлення:\n+380 XX XXX XX XX");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[char]));
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.innerHTML = `
    <img class="product-card__img" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
    <div class="product-card__body">
      <h3>${escapeHtml(product.name)}</h3>
      <p>Розмір: ${escapeHtml(product.size)}</p>
      <p class="product-card__price">${escapeHtml(product.price)}</p>
      <button class="btn btn--small" type="button">Замовити</button>
    </div>`;
  card.querySelector("button").addEventListener("click", showPhone);
  return card;
}

function createCategoryCard(category) {
  const card = document.createElement("a");
  card.className = "category-card";
  card.href = `catalog.html?category=${encodeURIComponent(category.slug)}`;
  card.innerHTML = `${category.image_url ? `<img src="${escapeHtml(category.image_url)}" alt="${escapeHtml(category.name)}" loading="lazy">` : ""}<h3>${escapeHtml(category.name)}</h3>`;
  return card;
}

function mapDbProduct(row) {
  return {
    name: row.name,
    size: row.size || "—",
    price: `${Number(row.price).toLocaleString("uk-UA")} грн`,
    image: row.image_url,
    category: row.categories?.slug
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("products-grid");
  const previewGrid = document.getElementById("preview-grid");
  const categoriesGrid = document.getElementById("categories-grid");
  const client = window.supabaseClient;
  let catalog = window.products || [];

  if (client) {
    const { data, error } = await client.from("products")
      .select("id,name,size,price,image_url,categories(name,slug)")
      .order("created_at", { ascending: false });
    if (!error && data) catalog = data.map(mapDbProduct);
    else console.error("Не вдалося завантажити товари з Supabase:", error?.message);
  }

  if (grid) {
    const slug = new URLSearchParams(location.search).get("category");
    const filtered = slug ? catalog.filter(item => item.category === slug) : catalog;
    filtered.forEach(item => grid.appendChild(createProductCard(item)));
    if (!filtered.length) grid.innerHTML = "<p>У цій категорії поки немає товарів.</p>";
  }

  if (previewGrid) catalog.slice(0, 2).forEach(item => previewGrid.appendChild(createProductCard(item)));

  if (categoriesGrid && client) {
    const { data, error } = await client.from("categories")
      .select("id,name,slug,image_url").order("name");
    if (!error && data) {
      categoriesGrid.replaceChildren(...data.map(createCategoryCard));
      if (!data.length) categoriesGrid.innerHTML = "<p>Категорій поки немає.</p>";
    } else if (error) {
      console.error("Не вдалося завантажити категорії з Supabase:", error.message);
    }
  }
});

// 12 rapid clicks on the shop logo open the admin page. The counter survives
// the normal navigation back to index.html between clicks.
document.querySelectorAll(".js-secret-admin").forEach(logo => {
  logo.addEventListener("click", event => {
    const key = "rattan-admin-clicks";
    const now = Date.now();
    let state;
    try { state = JSON.parse(sessionStorage.getItem(key) || "null"); } catch { state = null; }
    const count = state && now - state.time < 10000 ? state.count + 1 : 1;
    sessionStorage.setItem(key, JSON.stringify({ count, time: now }));
    if (count >= 5) {
      event.preventDefault();
      sessionStorage.removeItem(key);
      location.href = "admin.html";
    }
  });
});
