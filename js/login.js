// =========================================================
// Login y registro con Supabase Auth. Requiere common.js.
// =========================================================

const redirectTo = destinoSeguro(new URLSearchParams(window.location.search).get("redirect"));

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const mensajeEl = document.getElementById("auth-mensaje");

function mostrarMensaje(texto, tipo = "error") {
  mensajeEl.textContent = texto;
  mensajeEl.className = "msg " + (tipo === "error" ? "msg-error" : "msg-ok");
  mensajeEl.hidden = !texto;
}

function cambiarTab(tab) {
  const esLogin = tab === "login";
  tabLogin.classList.toggle("active", esLogin);
  tabRegister.classList.toggle("active", !esLogin);
  formLogin.hidden = !esLogin;
  formRegister.hidden = esLogin;
  mostrarMensaje("");
}
tabLogin.addEventListener("click", () => cambiarTab("login"));
tabRegister.addEventListener("click", () => cambiarTab("register"));

// Si ya hay sesión activa no tiene sentido mostrar el login.
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = redirectTo;
})();

function traducirError(msg) {
  const mapa = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "User already registered": "Ya existe una cuenta con ese correo.",
    "Email not confirmed": "Debes confirmar tu correo antes de iniciar sesión.",
  };
  return mapa[msg] || msg;
}

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const boton = formLogin.querySelector("button[type=submit]");
  boton.disabled = true;
  boton.textContent = "Ingresando...";
  mostrarMensaje("");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById("login-email").value.trim(),
    password: document.getElementById("login-password").value,
  });

  boton.disabled = false;
  boton.textContent = "Ingresar";
  if (error) {
    mostrarMensaje(traducirError(error.message));
    return;
  }
  window.location.href = redirectTo;
});

formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("register-password").value;
  if (password.length < 6) {
    mostrarMensaje("La contraseña debe tener al menos 6 caracteres.");
    return;
  }
  const boton = formRegister.querySelector("button[type=submit]");
  boton.disabled = true;
  boton.textContent = "Creando cuenta...";
  mostrarMensaje("");

  const { data, error } = await supabaseClient.auth.signUp({
    email: document.getElementById("register-email").value.trim(),
    password,
    options: { data: { full_name: document.getElementById("register-nombre").value.trim() } },
  });

  boton.disabled = false;
  boton.textContent = "Crear cuenta";
  if (error) {
    mostrarMensaje(traducirError(error.message));
    return;
  }
  if (data.session) {
    window.location.href = redirectTo;
  } else {
    mostrarMensaje("Cuenta creada. Revisa tu correo para confirmarla antes de ingresar.", "ok");
    cambiarTab("login");
  }
});
