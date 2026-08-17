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
const joursOrdreInfos = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

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

function normaliserLienInfos(valeur) {
  return String(valeur || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function joursDepuisValeurInfos(valeur) {
  if (Array.isArray(valeur)) {
    const valeurs = valeur.map(normaliserLienInfos);
    return joursOrdreInfos.filter(j => valeurs.includes(j));
  }
  const texte = normaliserLienInfos(valeur);
  if (!texte) return [];
  const alias = {
    lundi: ["lundi", "lun"], mardi: ["mardi", "mar"], mercredi: ["mercredi", "mer"],
    jeudi: ["jeudi", "jeu"], vendredi: ["vendredi", "ven"], samedi: ["samedi", "sam"], dimanche: ["dimanche", "dim"]
  };
  return joursOrdreInfos.filter(j => alias[j].some(a => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(texte)));
}

let chantiersInfos = [];
let arretChantiersInfos = null;
let minuterieRafraichissementInfos = null;

function planningInfosDuChantier(site) {
  if (!site) return null;
  const bloc = site.conteneursPlanningV1 || {};
  const valeurs = {};
  ["sortieOM", "rentreeOM", "sortieTRI", "rentreeTRI"].forEach(cle => {
    valeurs[cle] = joursDepuisValeurInfos(Array.isArray(bloc[cle]) ? bloc[cle] : site[cle]);
  });
  const canonique = !!(site.conteneursPlanningV1 && typeof site.conteneursPlanningV1 === "object");
  const legacyExploitable = Object.values(valeurs).some(v => v.length);
  return { ...valeurs, actif: canonique || legacyExploitable };
}

function chantierInfosPourPlanning(planning) {
  if (!planning) return null;
  const id = String(planning.chantierId || planning.sourceChantierId || "");
  if (id) {
    const direct = chantiersInfos.find(c => String(c.id) === id);
    if (direct) return direct;
  }
  const nom = normaliserLienInfos(planning.chantierNom);
  const adresse = normaliserLienInfos(planning.adresse);
  if (!nom && !adresse) return null;
  return chantiersInfos.find(c => nom && normaliserLienInfos(c.nom) === nom && (!adresse || normaliserLienInfos(c.adresse) === adresse))
    || chantiersInfos.find(c => nom && normaliserLienInfos(c.nom) === nom)
    || chantiersInfos.find(c => adresse && normaliserLienInfos(c.adresse) === adresse)
    || null;
}

function joursInfosPourPlanning(planning) {
  const site = chantierInfosPourPlanning(planning);
  const info = planningInfosDuChantier(site);
  if (!info?.actif) return null;
  const action = planning.action === "rentree" ? "rentree" : "sortie";
  const type = String(planning.typeConteneur || "OM").toUpperCase();
  const om = info[`${action}OM`] || [];
  const tri = info[`${action}TRI`] || [];
  if (type === "OM") return om.slice();
  if (type === "TRI") return tri.slice();
  if (type === "OM/TRI") return joursOrdreInfos.filter(j => om.includes(j) || tri.includes(j));
  return null;
}

function frequenceValidePourDate(planning, date) {
  const semaine = numeroSemaine(date);
  if (planning.frequence === "paire" && semaine % 2 !== 0) return false;
  if (planning.frequence === "impaire" && semaine % 2 === 0) return false;
  return true;
}

function planningActifAujourdHui(planning, date = new Date()) {
  if (!planning.actif) return false;
  const jour = jours[date.getDay()];
  const joursInfos = joursInfosPourPlanning(planning);
  if (joursInfos) {
    if (!joursInfos.includes(jour)) return false;
  } else if (planning.jour !== jour) {
    return false;
  }
  return frequenceValidePourDate(planning, date);
}

function typeConteneurEffectif(planning, date = new Date()) {
  const type = String(planning?.typeConteneur || "");
  if (type !== "OM/TRI") return type;
  const site = chantierInfosPourPlanning(planning);
  const info = planningInfosDuChantier(site);
  if (!info?.actif) return type;
  const action = planning.action === "rentree" ? "rentree" : "sortie";
  const jour = jours[date.getDay()];
  const om = (info[`${action}OM`] || []).includes(jour);
  const tri = (info[`${action}TRI`] || []).includes(jour);
  return om && tri ? "OM/TRI" : om ? "OM" : tri ? "TRI" : type;
}

function libelleJoursInfosPlanning(planning) {
  const liste = joursInfosPourPlanning(planning);
  if (!liste) return planning?.jour || "";
  const courts = {lundi:"Lun",mardi:"Mar",mercredi:"Mer",jeudi:"Jeu",vendredi:"Ven",samedi:"Sam",dimanche:"Dim"};
  return liste.length ? liste.map(j => courts[j] || j).join(" · ") : "Aucun jour";
}

function programmerRafraichissementInfos() {
  clearTimeout(minuterieRafraichissementInfos);
  minuterieRafraichissementInfos = setTimeout(() => {
    try {
      window.dispatchEvent(new CustomEvent("inovtec:conteneurs-infos-chantiers", { detail: { chantiers: chantiersInfos } }));
      if (typeof window.charger === "function") {
        const r = window.charger();
        if (r && typeof r.catch === "function") r.catch(console.error);
      }
    } catch (e) { console.warn("Rafraîchissement Infos chantier ignoré", e); }
  }, 120);
}

function demarrerLienInfosChantiers(user) {
  if (arretChantiersInfos) { try { arretChantiersInfos(); } catch {} arretChantiersInfos = null; }
  chantiersInfos = [];
  if (!user) return;
  arretChantiersInfos = db.collection("chantiers").onSnapshot(snapshot => {
    chantiersInfos = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c._hidden !== true && c._type !== "disciplinePhotoChunk");
    programmerRafraichissementInfos();
  }, error => console.warn("Lien Infos chantier → Conteneurs indisponible", error));
}

auth.onAuthStateChanged(demarrerLienInfosChantiers);
window.InovtecConteneursInfos = {
  get chantiers() { return chantiersInfos.slice(); },
  chantierInfosPourPlanning,
  planningInfosDuChantier,
  joursInfosPourPlanning,
  libelleJoursInfosPlanning,
  typeConteneurEffectif
};

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
