const firebaseConfig = {
  apiKey: "AIzaSyCd_A1V-CRWGxbEmGFDadNFbGqXLocBDPw",
  authDomain: "inovtec-chantiers.firebaseapp.com",
  projectId: "inovtec-chantiers",
  storageBucket: "inovtec-chantiers.firebasestorage.app",
  messagingSenderId: "313162345276",
  appId: "1:313162345276:web:1a270f797dd736a4060c39"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
window.auth = firebase.auth();

const jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function dateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function numeroSemaine(date = new Date()) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
}

function planningActifAujourdHui(planning, date = new Date()) {
  if (!planning.actif) return false;
  if (planning.jour !== jours[date.getDay()]) return false;
  const semaine = numeroSemaine(date);
  if (planning.frequence === "paire" && semaine % 2 !== 0) return false;
  if (planning.frequence === "impaire" && semaine % 2 === 0) return false;
  return true;
}

function remplacementPourDate(planning, date = new Date()) {
  const iso = dateISO(date);
  const remplacements = Array.isArray(planning.remplacements) ? planning.remplacements : [];
  return remplacements
    .filter(r => r && !r.annule && r.agentId && r.debut && r.fin && r.debut <= iso && iso <= r.fin)
    .sort((a, b) => String(b.creeLe || "").localeCompare(String(a.creeLe || "")))[0] || null;
}

function agentEffectifPourDate(planning, date = new Date()) {
  const remplacement = remplacementPourDate(planning, date);
  if (remplacement) {
    return {
      agentId: remplacement.agentId,
      agentNom: remplacement.agentNom || remplacement.agentId,
      estRemplacant: true,
      remplacementId: remplacement.id || "",
      titulaireId: planning.agentId || "",
      titulaireNom: planning.agentNom || planning.agentId || ""
    };
  }
  return {
    agentId: planning.agentId || "",
    agentNom: planning.agentNom || planning.agentId || "",
    estRemplacant: false,
    remplacementId: "",
    titulaireId: planning.agentId || "",
    titulaireNom: planning.agentNom || planning.agentId || ""
  };
}

function idPointage(planningId, date = new Date()) {
  return `${planningId}_${dateISO(date)}`;
}
