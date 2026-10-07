// =========================================================
// Login y registro con Supabase Auth.
// =========================================================

const params = new URLSearchParams(window.location.search);
const redirectTo = params.get("redirect") || "eventos.html";

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const mensajeEl = document.getElementById("auth-mensaje");

function mostrarMensaje(texto, tipo = "error") {
  if (!mensajeEl) return;
  mensajeEl.textContent = texto;
  mensajeEl.className = "auth-mensaje " + (tipo === "error" ? "auth-error" : "auth-ok");
  mensajeEl.style.display = texto ? "block" : "none";
}

function cambiarTab(tab) {
  const esLogin = tab === "login";
  tabLogin.classList.toggle("active", esLogin);
  tabRegister.classList.toggle("active", !esLogin);
  formLogin.style.display = esLogin ? "grid" : "none";
  formRegister.style.display = esLogin ? "none" : "grid";
  mostrarMensaje("");
}

if (tabLogin && tabRegister) {
  tabLogin.addEventListener("click", () => cambiarTab("login"));
  tabRegister.addEventListener("click", () => cambiarTab("register"));
}

// Si ya hay sesión activa, no tiene sentido mostrar el login.
(async () => {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = redirectTo;
  }
})();

if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = formLogin.querySelector("button[type=submit]");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    boton.disabled = true;
    boton.textContent = "Ingresando...";
    mostrarMensaje("");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    boton.disabled = false;
    boton.textContent = "Ingresar";

    if (error) {
      mostrarMensaje(traducirError(error.message));
      return;
    }
    window.location.href = redirectTo;
  });
}

if (formRegister) {
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = formRegister.querySelector("button[type=submit]");
    const nombre = document.getElementById("register-nombre").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    if (password.length < 6) {
      mostrarMensaje("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    boton.disabled = true;
    boton.textContent = "Creando cuenta...";
    mostrarMensaje("");

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombre } },
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
      mostrarMensaje(
        "Cuenta creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.",
        "ok"
      );
      cambiarTab("login");
    }
  });
}

function traducirError(msg) {
  const mapa = {
    "Invalid login credentials": "Usuario o contraseña incorrectos.",
    "User already registered": "Ya existe una cuenta con ese correo.",
    "Email not confirmed": "Debes confirmar tu correo antes de iniciar sesión.",
  };
  return mapa[msg] || msg;
}
