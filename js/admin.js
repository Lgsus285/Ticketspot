// Panel administrativo de Ticketspot. Requiere app_metadata.role = 'admin'.
const $ = (id) => document.getElementById(id);
let adminEvents = [];

function adminMessage(text, type = "error") {
  const el = $("admin-message");
  el.textContent = text;
  el.className = `msg ${type === "error" ? "msg-error" : "msg-ok"}`;
  el.hidden = !text;
}
function money(value) { return "$" + Number(value || 0).toFixed(2); }
function shortDate(value) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function requireAdmin() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session) {
    window.location.replace("login.html?redirect=admin.html");
    return false;
  }
  if (session.user.app_metadata?.role !== "admin") {
    document.querySelector(".admin-main").innerHTML = `<section class="admin-denied"><h1>Acceso restringido</h1><p>Tu cuenta no tiene permisos de administrador.</p><a class="btn-primary" href="index.html">Volver al sitio</a></section>`;
    return false;
  }
  $("admin-welcome").textContent = `Sesión iniciada como ${session.user.email}`;
  return true;
}

async function loadDashboard() {
  adminMessage("");
  const [eventsResult, ordersResult] = await Promise.all([
    supabaseClient.from("events").select("*").order("event_date", { ascending: true }),
    supabaseClient.from("orders").select("id,ticket_code,buyer_name,buyer_email,quantity,total,status,created_at,events(title)").order("created_at", { ascending: false }).limit(100)
  ]);
  if (eventsResult.error || ordersResult.error) {
    adminMessage(`No se pudo cargar el panel: ${(eventsResult.error || ordersResult.error).message}. Verifica que ejecutaste supabase/admin_setup.sql.`);
    return;
  }
  adminEvents = eventsResult.data || [];
  const orders = ordersResult.data || [];
  $("stat-events").textContent = adminEvents.length;
  $("stat-orders").textContent = orders.length;
  $("stat-tickets").textContent = orders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);
  $("stat-revenue").textContent = money(orders.reduce((sum, o) => sum + Number(o.total || 0), 0));
  renderEvents();
  renderOrders(orders);
}

function renderEvents() {
  const q = $("event-search").value.trim().toLowerCase();
  const list = adminEvents.filter(e => `${e.title} ${e.category || ""} ${e.location || ""}`.toLowerCase().includes(q));
  $("events-table").innerHTML = list.length ? list.map(e => `
    <tr><td><strong>${esc(e.title)}</strong><small class="admin-muted">${esc(e.slug)}</small></td>
    <td>${shortDate(e.event_date)}</td><td>${esc(e.category || "Eventos")}</td>
    <td>${money(e.general_price)}</td><td><span class="admin-pill ${e.featured ? "is-featured" : ""}">${e.featured ? "Sí" : "No"}</span></td>
    <td><div class="admin-actions"><button class="admin-action" data-edit="${e.id}">Editar</button><button class="admin-action danger" data-delete="${e.id}">Eliminar</button></div></td></tr>`).join("") : `<tr><td colspan="6">No hay eventos que coincidan con la búsqueda.</td></tr>`;
  $("events-table").querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openEventForm(adminEvents.find(e => e.id === b.dataset.edit))));
  $("events-table").querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteEvent(b.dataset.delete)));
}

function renderOrders(orders) {
  $("orders-table").innerHTML = orders.length ? orders.map(o => `<tr>
    <td><strong>${esc(o.ticket_code || "—")}</strong></td><td>${esc(o.buyer_name || "—")}<small class="admin-muted">${esc(o.buyer_email || "")}</small></td>
    <td>${esc(o.events?.title || "Evento eliminado")}</td><td>${new Date(o.created_at).toLocaleString("es-PA")}</td>
    <td>${Number(o.quantity || 0)}</td><td>${money(o.total)}</td><td><span class="admin-pill">${esc(o.status || "—")}</span></td></tr>`).join("") : `<tr><td colspan="7">Todavía no hay ventas registradas.</td></tr>`;
}

function openEventForm(event = null) {
  $("event-form").reset();
  $("event-id").value = event?.id || "";
  $("dialog-title").textContent = event ? "Editar evento" : "Crear evento";
  $("event-title").value = event?.title || "";
  $("event-slug").value = event?.slug || "";
  $("event-category").value = event?.category || "Eventos";
  $("event-date").value = event?.event_date || "";
  $("event-location").value = event?.location || "";
  $("event-general").value = event?.general_price ?? "";
  $("event-vip").value = event?.vip_price ?? 0;
  $("event-layout").value = event?.layout || "general";
  $("event-image").value = event?.image_url || "";
  $("event-description").value = event?.description || "";
  $("event-featured").checked = !!event?.featured;
  $("event-dialog").showModal();
}

async function saveEvent(e) {
  e.preventDefault();
  const id = $("event-id").value;
  const title = $("event-title").value.trim();
  const date = $("event-date").value || null;
  const payload = {
    title,
    slug: $("event-slug").value.trim() || slugify(title),
    category: $("event-category").value.trim() || "Eventos",
    event_date: date,
    date_label: date ? shortDate(date) : null,
    location: $("event-location").value.trim(),
    general_price: Number($("event-general").value),
    vip_price: Number($("event-vip").value),
    layout: $("event-layout").value,
    image_url: $("event-image").value.trim(),
    description: $("event-description").value.trim(),
    summary: $("event-description").value.trim().slice(0, 180),
    featured: $("event-featured").checked
  };
  const button = $("save-event");
  button.disabled = true; button.textContent = "Guardando...";
  const result = id ? await supabaseClient.from("events").update(payload).eq("id", id) : await supabaseClient.from("events").insert(payload);
  button.disabled = false; button.textContent = "Guardar evento";
  if (result.error) { adminMessage(`No se pudo guardar: ${result.error.message}`); return; }
  $("event-dialog").close();
  adminMessage(id ? "Evento actualizado correctamente." : "Evento creado correctamente.", "ok");
  await loadDashboard();
}

async function deleteEvent(id) {
  const event = adminEvents.find(e => e.id === id);
  if (!event || !confirm(`¿Eliminar el evento «${event.title}»? Esta acción no se puede deshacer.`)) return;
  const { error } = await supabaseClient.from("events").delete().eq("id", id);
  if (error) { adminMessage(`No se pudo eliminar. Si tiene compras asociadas, la base de datos impedirá borrarlo. Detalle: ${error.message}`); return; }
  adminMessage("Evento eliminado.", "ok");
  await loadDashboard();
}

async function initAdmin() {
  if (!await requireAdmin()) return;
  $("new-event").addEventListener("click", () => openEventForm());
  $("close-dialog").addEventListener("click", () => $("event-dialog").close());
  $("cancel-event").addEventListener("click", () => $("event-dialog").close());
  $("event-form").addEventListener("submit", saveEvent);
  $("event-search").addEventListener("input", renderEvents);
  $("event-title").addEventListener("input", () => { if (!$("event-id").value) $("event-slug").value = slugify($("event-title").value); });
  $("admin-logout").addEventListener("click", async e => { e.preventDefault(); await supabaseClient.auth.signOut(); window.location.replace("index.html"); });
  await loadDashboard();
}
document.addEventListener("DOMContentLoaded", initAdmin);
