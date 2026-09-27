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
function frequenceValide(valeur) {
  const v=String(valeur||"");
  return ["toutes","paire","impaire"].includes(v)?v:"";
}

function frequenceActivePourDate(frequence,date) {
  const f=frequenceValide(frequence)||"toutes";
  const semaine=numeroSemaine(date);
  if(f==="paire")return semaine%2===0;
  if(f==="impaire")return semaine%2!==0;
  return true;
}

function frequenceValidePourDate(planning, date) {
  return frequenceActivePourDate(planning?.frequence,date);
}

function planningActifAujourdHui(planning, date = new Date()) {
  if (!planning || planning.actif === false) return false;
  if (String(planning.jour || "") !== jours[date.getDay()]) return false;
  return frequenceValidePourDate(planning, date);
}

function typeConteneurEffectif(planning) {
  return String(planning?.typeConteneur || "");
}

// Compatibilité avec les pages existantes : aucune déduplication ou lecture
// externe n'est appliquée. Chaque programmation CONTENEURS reste autonome.
function dedoublonnerPlanningsActifsInfos(plans) {
  return Array.isArray(plans) ? plans.slice() : [];
}

function libelleJoursInfosPlanning(planning) {
  return String(planning?.jour || "");
}

function libelleFrequenceInfosPlanning(planning) {
  const labels={toutes:"Toutes les semaines",paire:"Semaines paires",impaire:"Semaines impaires"};
  const f=frequenceValide(planning?.frequence)||"toutes";
  return labels[f]||f;
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
