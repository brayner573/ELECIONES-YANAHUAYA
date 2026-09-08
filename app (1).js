// ============================================================
// Firebase v9 (modular) vía CDN
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  collection,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ------------------------------------------------------------
// Configuración de Firebase
// ------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyB9t5tE3cgvhF9mkKmaLzhQBVjXvKojW3A",
  authDomain: "elecciones-yanahuaya.firebaseapp.com",
  databaseURL: "https://elecciones-yanahuaya-default-rtdb.firebaseio.com",
  projectId: "elecciones-yanahuaya",
  storageBucket: "elecciones-yanahuaya.firebasestorage.app",
  messagingSenderId: "376834976303",
  appId: "1:376834976303:web:8c901369b10f32d8e634da",
  measurementId: "G-E9M31T9DHS",
};

// ------------------------------------------------------------
// Lista de candidatos — en el orden de la cédula.
// Cambia "photo" por la URL real cuando la tengas.
// ------------------------------------------------------------
const CANDIDATOS = [
  {
    id: "candidato1",
    numero: 1,
    nombre: "John Durand Ticona",
    simbolo: "Ahora Nación",
    color: "#e63946",
    photo: "https://ui-avatars.com/api/?name=John+Durand+Ticona&background=e63946&color=fff&size=160&font-size=0.33&bold=true",
  },
  {
    id: "candidato2",
    numero: 2,
    nombre: "Wiliam Megiry Chuquija Tito",
    simbolo: "ASI - Juntos por el Perú",
    color: "#d4a017",
    photo: "https://ui-avatars.com/api/?name=Wiliam+Chuquija&background=a9803f&color=fff&size=160&font-size=0.33&bold=true",
  },
  {
    id: "candidato3",
    numero: 3,
    nombre: "Edgar Willes Quispe Zapata",
    simbolo: "Partido Político Perú Primero",
    color: "#2ecc71",
    photo: "https://ui-avatars.com/api/?name=Edgar+Quispe+Zapata&background=3f6e4d&color=fff&size=160&font-size=0.33&bold=true",
  },
  {
    id: "candidato4",
    numero: 4,
    nombre: "Aronil Exorsi del Avila Arizapana",
    simbolo: "Salvemos al Perú",
    color: "#9b59b6",
    photo: "https://ui-avatars.com/api/?name=Aronil+Avila&background=6c3483&color=fff&size=160&font-size=0.33&bold=true",
  },
  {
    id: "candidato5",
    numero: 5,
    nombre: "Clever Esais Caceres Calcina",
    simbolo: "Clever Esais Caceres Calcina",
    color: "#e67e22",
    photo: "https://ui-avatars.com/api/?name=Clever+Caceres&background=8c1f24&color=fff&size=160&font-size=0.33&bold=true",
  },
];

const VOTE_KEY = "eleccionLocal_yaVoto";

// Estado en memoria
const voteState = {};
CANDIDATOS.forEach((c) => (voteState[c.id] = 0));

// Referencias al DOM
const ballotEl        = document.getElementById("ballot");
const loadingEl       = document.getElementById("loading");
const totalsEl        = document.getElementById("totals");
const totalVotesLabel = document.getElementById("totalVotesLabel");
const toastEl         = document.getElementById("toast");

const yaVoto           = () => localStorage.getItem(VOTE_KEY);
const marcarComoVotado = (id) => localStorage.setItem(VOTE_KEY, id);

// ── Firebase init (aislado para que un error no rompa la UI) ──
let db = null;
try {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
} catch (err) {
  console.error("Error iniciando Firebase:", err);
}

// ------------------------------------------------------------
// Construye las tarjetas de candidatos en el DOM
// ------------------------------------------------------------
function renderBallot() {
  // Limpia el contenedor pero mantiene el loading fuera del flujo
  const existingRows = ballotEl.querySelectorAll(".candidate");
  existingRows.forEach((el) => el.remove());

  const votedId = yaVoto();

  CANDIDATOS.forEach((c) => {
    const row = document.createElement("article");
    row.className = "candidate";
    row.id = `row-${c.id}`;

    let btnText     = "Votar";
    let btnClass    = "vote-btn";
    let btnDisabled = false;

    if (votedId) {
      btnDisabled = true;
      if (votedId === c.id) {
        btnText  = "✓ Tu voto";
        btnClass = "vote-btn is-voted";
      } else {
        btnText = "Votación cerrada";
      }
    }

    row.innerHTML = `
      <span class="candidate__number" style="color:${c.color}">${c.numero}</span>

      <div class="candidate__photo-wrap">
        <img
          class="candidate__photo"
          src="${c.photo}"
          alt="Foto de ${c.nombre}"
          loading="lazy"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(c.nombre)}&background=333&color=fff&size=160'"
        >
        <span class="candidate__symbol-badge" title="${c.simbolo}">${c.simbolo}</span>
      </div>

      <div class="candidate__info">
        <p class="candidate__name">${c.nombre}</p>
        <p class="candidate__party">${c.simbolo}</p>
        <div class="candidate__meter">
          <div class="candidate__meter-fill" id="fill-${c.id}"></div>
        </div>
        <div class="candidate__stats">
          <span class="candidate__votes-count" id="count-${c.id}">0</span>
          <span>votos</span>
          <span class="candidate__pct" id="pct-${c.id}">0%</span>
          <span class="candidate__leading-label">★ Líder</span>
        </div>
      </div>

      <div class="candidate__action">
        <button
          class="${btnClass}"
          id="btn-${c.id}"
          data-id="${c.id}"
          ${btnDisabled ? "disabled" : ""}
          aria-label="Votar por ${c.nombre}"
        >${btnText}</button>
      </div>

      <span class="candidate__crown" aria-hidden="true">👑</span>
    `;

    ballotEl.appendChild(row);

    if (!votedId) {
      row.querySelector(".vote-btn").addEventListener("click", () => emitirVoto(c.id));
    }
  });

  // Ocultar loading y mostrar contador
  if (loadingEl) loadingEl.hidden = true;
  if (totalsEl)  totalsEl.hidden  = false;
}

// ------------------------------------------------------------
// Actualiza barras y contadores con los datos de Firestore
// ------------------------------------------------------------
function actualizarUI() {
  const total    = Object.values(voteState).reduce((a, b) => a + b, 0);
  const maxVotos = Math.max(0, ...Object.values(voteState));

  CANDIDATOS.forEach((c) => {
    const votos = voteState[c.id] || 0;
    const pct   = total > 0 ? ((votos / total) * 100).toFixed(1) : "0.0";

    const fillEl  = document.getElementById(`fill-${c.id}`);
    const countEl = document.getElementById(`count-${c.id}`);
    const pctEl   = document.getElementById(`pct-${c.id}`);
    const rowEl   = document.getElementById(`row-${c.id}`);

    if (fillEl)  fillEl.style.width  = `${pct}%`;
    if (countEl) countEl.textContent = votos.toLocaleString();
    if (pctEl)   pctEl.textContent   = `${pct}%`;
    if (rowEl)   rowEl.classList.toggle("is-leading", votos > 0 && votos === maxVotos);
  });

  if (totalVotesLabel) totalVotesLabel.textContent = total.toLocaleString();
}

// ------------------------------------------------------------
// Escucha cambios en tiempo real en Firestore
// ------------------------------------------------------------
function escucharVotosEnTiempoReal() {
  if (!db) {
    console.warn("Firebase no disponible — resultados en tiempo real desactivados.");
    return;
  }

  try {
    const candidatosRef = collection(db, "candidatos");
    onSnapshot(
      candidatosRef,
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          if (Object.prototype.hasOwnProperty.call(voteState, docSnap.id)) {
            voteState[docSnap.id] = docSnap.data().votes || 0;
          }
        });
        actualizarUI();
      },
      (error) => {
        console.error("Error escuchando Firestore:", error);
      }
    );
  } catch (err) {
    console.error("Error al iniciar listener:", err);
  }
}

// ------------------------------------------------------------
// Registra el voto en Firestore
// ------------------------------------------------------------
async function emitirVoto(candidatoId) {
  if (yaVoto()) return;

  const btn = document.getElementById(`btn-${candidatoId}`);
  if (!btn) return;

  btn.disabled    = true;
  btn.textContent = "Enviando…";

  if (!db) {
    // Sin Firebase: registrar solo localmente
    marcarComoVotado(candidatoId);
    mostrarAgradecimiento();
    renderBallot();
    return;
  }

  try {
    const ref = doc(db, "candidatos", candidatoId);
    await updateDoc(ref, { votes: increment(1) });
    marcarComoVotado(candidatoId);
    mostrarAgradecimiento();
    renderBallot();
    actualizarUI();
  } catch (error) {
    console.error("Error al votar:", error);
    if (error.code === "not-found") {
      try {
        await setDoc(doc(db, "candidatos", candidatoId), { votes: 1 });
        marcarComoVotado(candidatoId);
        mostrarAgradecimiento();
        renderBallot();
        actualizarUI();
        return;
      } catch (e2) {
        console.error("Error creando documento:", e2);
      }
    }
    btn.disabled    = false;
    btn.textContent = "Votar";
    alert("No se pudo registrar tu voto. Verifica tu conexión e inténtalo de nuevo.");
  }
}

function mostrarAgradecimiento() {
  if (!toastEl) return;
  toastEl.hidden = false;
  setTimeout(() => { toastEl.hidden = true; }, 6000);
}

// ------------------------------------------------------------
// ARRANQUE — renderiza candidatos primero, Firebase después
// ------------------------------------------------------------
renderBallot();           // siempre funciona (datos locales)
escucharVotosEnTiempoReal(); // conecta Firebase para votos en vivo
