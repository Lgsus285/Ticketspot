// =========================================================
// Generador de mapas de asientos.
//   buildSeatLayout("teatro") -> platea con 3 bloques y pasillos
//   buildSeatLayout("arena")  -> escenario, pista al frente y gradas alrededor
// Devuelve { width, height, stage, labels, rowLabels, seats } con las
// coordenadas ya calculadas para dibujar en SVG.
// Cada asiento: { id, section, row, num, x, y, tier }
// Requiere common.js (SECCIONES_VIP).
// =========================================================

const FILAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function nivelSeccion(seccion) {
  return SECCIONES_VIP.includes(seccion) ? "vip" : "general";
}

function nuevoAsiento(seccion, fila, num, x, y) {
  return {
    id: `${seccion}|${fila}|${num}`,
    section: seccion,
    row: fila,
    num,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    tier: nivelSeccion(seccion),
  };
}

// ---------- Teatro ----------
function layoutTeatro() {
  const ancho = 900;
  const paso = 26; // separación entre asientos
  const pasillo = 44;
  const bloques = [
    { clave: "IZQ", n: 6 },
    { clave: "CEN", n: 10 },
    { clave: "DER", n: 6 },
  ];
  const totalAncho = bloques.reduce((a, b) => a + b.n * paso, 0) + pasillo * 2;
  let x0 = (ancho - totalAncho) / 2;
  const inicios = {};
  bloques.forEach((b) => {
    inicios[b.clave] = x0;
    x0 += b.n * paso + pasillo;
  });

  const filas = 12;
  const baseY = 130;
  const pasoY = 30;
  const vipFilas = 3; // filas A-C = VIP
  const mitad = totalAncho / 2;
  const seats = [];
  const rowLabels = [];

  for (let r = 0; r < filas; r++) {
    const fila = FILAS[r];
    const prefijo = r < vipFilas ? "VIP" : "PLA";
    bloques.forEach((b) => {
      for (let i = 0; i < b.n; i++) {
        const cx = inicios[b.clave] + i * paso + paso / 2;
        const dx = (cx - ancho / 2) / mitad;
        const cy = baseY + r * pasoY + 14 * (1 - dx * dx); // las filas se curvan alrededor del escenario
        seats.push(nuevoAsiento(`${prefijo}-${b.clave}`, fila, i + 1, cx, cy));
      }
    });
    rowLabels.push({ x: inicios.IZQ - 16, y: baseY + r * pasoY + 18, text: fila });
    rowLabels.push({ x: inicios.DER + 6 * paso + 16, y: baseY + r * pasoY + 18, text: fila });
  }

  return {
    width: ancho,
    height: 540,
    kind: "teatro",
    stage: { x: 250, y: 28, w: 400, h: 44, text: "ESCENARIO" },
    seatSize: 20,
    labels: [
      { x: ancho / 2, y: 106, text: "Primeras filas: VIP" },
    ],
    rowLabels,
    seats,
  };
}

// ---------- Arena (pista + gradas) ----------
function layoutArena() {
  const ancho = 900;
  const seats = [];
  const rowLabels = [];
  const labels = [];

  // Pista: 6 filas x 14 asientos frente al escenario
  const cx = 450;
  const cy = 185;
  const pasoPista = 20;
  const colsPista = 14;
  const x0 = cx - (colsPista * pasoPista) / 2 + pasoPista / 2;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < colsPista; c++) {
      seats.push(nuevoAsiento("PISTA", FILAS[r], c + 1, x0 + c * pasoPista, 130 + r * pasoPista));
    }
    rowLabels.push({ x: x0 - 18, y: 134 + r * pasoPista, text: FILAS[r] });
  }
  labels.push({ x: cx, y: 118, text: "Pista VIP" });

  // Gradas: 6 filas de arcos concéntricos alrededor de la pista
  const gradas = [
    { id: "LAT-DER", nombre: "Lateral derecho", a0: -25, a1: 28 },
    { id: "FON-DER", nombre: "Fondo derecho", a0: 32, a1: 70 },
    { id: "FON-CEN", nombre: "Fondo centro", a0: 74, a1: 106 },
    { id: "FON-IZQ", nombre: "Fondo izquierdo", a0: 110, a1: 148 },
    { id: "LAT-IZQ", nombre: "Lateral izquierdo", a0: 152, a1: 205 },
  ];
  const r0 = 190;
  const pasoR = 22;
  const pasoArco = 19;
  const rad = (g) => (g * Math.PI) / 180;

  gradas.forEach((g) => {
    for (let f = 0; f < 6; f++) {
      const r = r0 + f * pasoR;
      const barrido = rad(g.a1 - g.a0);
      const n = Math.max(1, Math.floor((barrido * r) / pasoArco));
      for (let i = 0; i < n; i++) {
        const ang = rad(g.a0) + ((i + 0.5) * barrido) / n;
        seats.push(nuevoAsiento(g.id, FILAS[f], i + 1, cx + r * Math.cos(ang), cy + r * Math.sin(ang)));
      }
    }
    const medio = rad((g.a0 + g.a1) / 2);
    const rl = r0 + 6 * pasoR + 14;
    const cos = Math.cos(medio);
    labels.push({
      x: cx + rl * cos,
      y: cy + rl * Math.sin(medio) + 4,
      text: g.nombre,
      anchor: cos < -0.5 ? "end" : cos > 0.5 ? "start" : "middle", // los laterales se alinean hacia afuera
    });
  });

  return {
    width: ancho,
    height: 540,
    kind: "arena",
    stage: { x: 340, y: 20, w: 220, h: 56, text: "ESCENARIO" },
    seatSize: 14,
    labels,
    rowLabels,
    seats,
  };
}

function buildSeatLayout(nombre) {
  if (nombre === "teatro") return layoutTeatro();
  if (nombre === "arena") return layoutArena();
  return null;
}

// Cuántos asientos tiene cada nivel (útil para mostrar disponibilidad)
function contarAsientos(layout) {
  const total = layout.seats.length;
  return { total, vip: layout.seats.filter((s) => s.tier === "vip").length };
}
