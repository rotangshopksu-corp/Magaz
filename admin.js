const client = window.supabaseClient;
const $ = selector => document.querySelector(selector);
let categories = [];
let products = [];
let editingCategory = null;
let editingProduct = null;

function message(text, isError = false, login = false) {
  const target = $(login ? "#login-message" : "#admin-message");
  target.textContent = text;
  target.classList.toggle("is-error", isError);
}

function showDashboard(visible) {
  $("#login-panel").hidden = visible;
  $("#dashboard").hidden = !visible;
}

function slugify(text) {
  const map = { а:"a",б:"b",в:"v",г:"h",ґ:"g",д:"d",е:"e",є:"ye",ж:"zh",з:"z",и:"y",і:"i",ї:"yi",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ь:"",ю:"yu",я:"ya",ы:"y",э:"e",ё:"yo",ъ:"" };
  return text.toLowerCase().split("").map(char => map[char] ?? char)
    .join("").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function safeText(parent, tag, value, className) {
  const element = document.createElement(tag);
  element.textContent = value ?? "";
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function makeRow({ image, title, subtitle, onEdit, onDelete }) {
  const row = document.createElement("div");
  row.className = "admin-row";
  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "";
    row.append(img);
  }
  const info = document.createElement("div");
  info.className = "admin-row__info";
  safeText(info, "strong", title);
  safeText(info, "small", subtitle || "");
  row.append(info);
  const actions = document.createElement("div");
  actions.className = "admin-row__actions";
  const edit = safeText(actions, "button", "Змінити");
  edit.type = "button";
  edit.addEventListener("click", onEdit);
  const remove = safeText(actions, "button", "Видалити");
  remove.type = "button";
  remove.addEventListener("click", onDelete);
  row.append(actions);
  return row;
}

function storagePathFromUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${window.SUPABASE_CONFIG.bucket}/`;
  const at = url.indexOf(marker);
  return at < 0 ? null : decodeURIComponent(url.slice(at + marker.length));
}

async function removeStoredImages(urls) {
  const paths = urls.map(storagePathFromUrl).filter(Boolean);
  if (!paths.length) return;
  const { error } = await client.storage.from(window.SUPABASE_CONFIG.bucket).remove(paths);
  if (error) console.warn("Не вдалося видалити старе фото зі Storage:", error.message);
}

async function uploadImage(file, folder) {
  if (!file) return null;
  if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Завантажуйте фото у форматі JPG, PNG або WebP.");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Розмір фото має бути до 8 МБ.");
  const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(window.SUPABASE_CONFIG.bucket).upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type
  });
  if (error) throw error;
  return client.storage.from(window.SUPABASE_CONFIG.bucket).getPublicUrl(path).data.publicUrl;
}

async function loadData() {
  const [categoryResult, productResult] = await Promise.all([
    client.from("categories").select("*").order("name"),
    client.from("products").select("*,categories(name,slug)").order("created_at", { ascending: false })
  ]);
  if (categoryResult.error) throw categoryResult.error;
  if (productResult.error) throw productResult.error;
  categories = categoryResult.data || [];
  products = productResult.data || [];
  renderLists();
}

function renderLists() {
  const categoryList = $("#category-list");
  categoryList.replaceChildren();
  if (!categories.length) safeText(categoryList, "p", "Категорій поки немає.");
  categories.forEach(category => categoryList.append(makeRow({
    image: category.image_url,
    title: category.name,
    subtitle: category.slug,
    onEdit: () => editCategory(category),
    onDelete: () => deleteCategory(category)
  })));

  const select = $("#product-category");
  select.replaceChildren();
  const first = document.createElement("option");
  first.value = "";
  first.textContent = categories.length ? "Оберіть категорію" : "Спочатку створіть категорію";
  select.append(first);
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  });

  const productList = $("#product-list");
  productList.replaceChildren();
  if (!products.length) safeText(productList, "p", "Товарів поки немає.");
  products.forEach(product => productList.append(makeRow({
    image: product.image_url,
    title: product.name,
    subtitle: `${product.categories?.name || "Без категорії"} · ${product.size || "розмір не вказаний"} · ${Number(product.price).toLocaleString("uk-UA")} грн`,
    onEdit: () => editProduct(product),
    onDelete: () => deleteProduct(product)
  })));
}

function editCategory(category) {
  editingCategory = category;
  $("#category-id").value = category.id;
  $("#category-name").value = category.name;
  $("#category-image").value = "";
  $("#category-cancel").hidden = false;
  $("#category-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetCategoryForm() {
  editingCategory = null;
  $("#category-form").reset();
  $("#category-id").value = "";
  $("#category-cancel").hidden = true;
}

function editProduct(product) {
  editingProduct = product;
  $("#product-id").value = product.id;
  $("#product-name").value = product.name;
  $("#product-category").value = product.category_id;
  $("#product-size").value = product.size || "";
  $("#product-price").value = product.price;
  $("#product-image").value = "";
  $("#current-image").textContent = product.image_url ? "Поточне фото збережеться, якщо нове не вибрати." : "Фото поки немає.";
  $("#product-cancel").hidden = false;
  $("#product-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetProductForm() {
  editingProduct = null;
  $("#product-form").reset();
  $("#product-id").value = "";
  $("#current-image").textContent = "";
  $("#product-cancel").hidden = true;
}

async function deleteCategory(category) {
  if (!confirm(`Видалити категорію «${category.name}»? Її товари теж буде видалено.`)) return;
  try {
    const productImages = products.filter(product => product.category_id === category.id).map(product => product.image_url);
    const { error } = await client.from("categories").delete().eq("id", category.id);
    if (error) throw error;
    await removeStoredImages([category.image_url, ...productImages]);
    await loadData();
    message("Категорію та її товари видалено.");
  } catch (error) { message(error.message || "Не вдалося видалити категорію.", true); }
}

async function deleteProduct(product) {
  if (!confirm(`Видалити товар «${product.name}»?`)) return;
  try {
    const { error } = await client.from("products").delete().eq("id", product.id);
    if (error) throw error;
    await removeStoredImages([product.image_url]);
    await loadData();
    message("Товар видалено.");
  } catch (error) { message(error.message || "Не вдалося видалити товар.", true); }
}

async function isAdmin(user) {
  if (!user) return false;
  const { data, error } = await client.rpc("is_admin");
  return !error && data === true;
}

async function startSession(user) {
  if (!(await isAdmin(user))) {
    await client.auth.signOut();
    showDashboard(false);
    message("Цей обліковий запис не має прав адміністратора.", true, true);
    return;
  }
  showDashboard(true);
  try { await loadData(); message(""); }
  catch (error) { message(error.message || "Не вдалося завантажити дані.", true); }
}

if (!client) {
  showDashboard(false);
  message("Спочатку заповніть URL та ключ Supabase у supabase-config.js і застосуйте SQL-файл.", true, true);
} else {
  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const pin = $("#admin-pin").value;
    if (!/^\d{8,}$/.test(pin)) {
      message("Використайте цифровий пароль щонайменше з 8 цифр.", true, true);
      return;
    }
    message("Перевіряю пароль…", false, true);
    const { data, error } = await client.auth.signInWithPassword({
      email: window.SUPABASE_CONFIG.adminEmail,
      password: pin
    });
    if (error) {
      message("Не вдалося увійти. Перевірте пароль і налаштування Supabase.", true, true);
      return;
    }
    $("#admin-pin").value = "";
    await startSession(data.user);
  });

  $("#logout-button").addEventListener("click", async () => {
    await client.auth.signOut();
    showDashboard(false);
    message("Ви вийшли з адмін-панелі.", false, true);
  });

  $("#category-form").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const name = $("#category-name").value.trim();
      if (!name) throw new Error("Вкажіть назву категорії.");
      const file = $("#category-image").files[0];
      let imageUrl = editingCategory?.image_url || null;
      if (file) imageUrl = await uploadImage(file, "categories");
      const values = { name, slug: slugify(name), image_url: imageUrl };
      const query = editingCategory
        ? client.from("categories").update(values).eq("id", editingCategory.id)
        : client.from("categories").insert(values);
      const { error } = await query;
      if (error) throw error;
      if (file && editingCategory?.image_url) await removeStoredImages([editingCategory.image_url]);
      resetCategoryForm();
      await loadData();
      message("Категорію збережено.");
    } catch (error) { message(error.message || "Не вдалося зберегти категорію.", true); }
  });

  $("#product-form").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const name = $("#product-name").value.trim();
      const categoryId = Number($("#product-category").value);
      const price = Number($("#product-price").value);
      if (!name || !categoryId || !Number.isFinite(price) || price < 0) throw new Error("Перевірте назву, категорію та ціну товару.");
      const file = $("#product-image").files[0];
      let imageUrl = editingProduct?.image_url || null;
      if (file) imageUrl = await uploadImage(file, "products");
      const values = { name, category_id: categoryId, size: $("#product-size").value.trim() || null, price, image_url: imageUrl };
      const query = editingProduct
        ? client.from("products").update(values).eq("id", editingProduct.id)
        : client.from("products").insert(values);
      const { error } = await query;
      if (error) throw error;
      if (file && editingProduct?.image_url) await removeStoredImages([editingProduct.image_url]);
      resetProductForm();
      await loadData();
      message("Товар збережено.");
    } catch (error) { message(error.message || "Не вдалося зберегти товар.", true); }
  });

  $("#category-cancel").addEventListener("click", resetCategoryForm);
  $("#product-cancel").addEventListener("click", resetProductForm);

  client.auth.getSession().then(async ({ data, error }) => {
    if (error) return;
    if (data.session) await startSession(data.session.user);
  });
}
