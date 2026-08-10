function estVueAgent() {
  const chemin = location.pathname;
  return chemin.endsWith('/') || /index\.html$/.test(chemin);
}

function identifiantAgentDuLien() {
  return (new URLSearchParams(location.search).get('agent') || '').trim().toLowerCase();
}

function nettoyerIdentifiantCompte(valeur = '') {
  return valeur.trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function afficherConnexion(onReady) {
  const pageAgent = estVueAgent();
  const agentLien = identifiantAgentDuLien();
  let creationEnCours = false;
  let messageCompte = '';
  let utilisateurLance = null;

  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML = `
    <div style="width:min(92%,400px);background:white;border-radius:22px;padding:24px;box-shadow:0 20px 55px rgba(15,23,42,.22)">
      <div style="font-size:34px;text-align:center;margin-bottom:8px">🔐</div>
      <h2 style="text-align:center;margin:0 0 6px">Connexion</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 18px">Connecte-toi avec ton compte Inovtec.</p>

      <form id="authForm" style="display:grid;gap:10px">
        <input id="authEmail" type="email" autocomplete="username" placeholder="Adresse e-mail" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <input id="authPassword" type="password" autocomplete="current-password" placeholder="Mot de passe" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <button id="authSubmit" type="submit" class="ok" style="width:100%;padding:12px">Se connecter</button>
        <div id="authError" style="min-height:18px;color:#b91c1c;font-size:12px;text-align:center"></div>
      </form>

      ${pageAgent ? `
      <div style="display:flex;align-items:center;gap:10px;margin:18px 0;color:#94a3b8;font-size:12px"><span style="height:1px;background:#e2e8f0;flex:1"></span>Première connexion<span style="height:1px;background:#e2e8f0;flex:1"></span></div>
      <button id="authCreateToggle" type="button" class="btn secondary" style="width:100%;padding:12px">Créer mon compte agent</button>

      <form id="authCreateForm" style="display:none;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <input id="authPrenom" type="text" autocomplete="given-name" placeholder="Prénom" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;min-width:0">
          <input id="authNom" type="text" autocomplete="family-name" placeholder="Nom" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px;min-width:0">
        </div>
        ${agentLien ? `<div style="padding:10px 12px;border-radius:12px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:700">Lien agent détecté : ${agentLien}</div>` : `<input id="authAgentId" type="text" placeholder="Identifiant agent fourni par le responsable" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">`}
        <input id="authCreateEmail" type="email" autocomplete="email" placeholder="Adresse e-mail" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <input id="authCreatePassword" type="password" autocomplete="new-password" minlength="6" placeholder="Mot de passe (6 caractères minimum)" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <input id="authCreatePasswordConfirm" type="password" autocomplete="new-password" minlength="6" placeholder="Confirmer le mot de passe" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <button id="authCreateSubmit" type="submit" class="ok" style="width:100%;padding:12px">Envoyer ma demande</button>
        <div id="authCreateError" style="min-height:18px;color:#b91c1c;font-size:12px;text-align:center"></div>
        <div style="color:#64748b;font-size:11px;line-height:1.4;text-align:center">Le compte restera bloqué jusqu’à validation par un responsable.</div>
      </form>` : ''}
    </div>`;
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '99999', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '16px',
    background: 'linear-gradient(145deg,#ecfdf5,#f8fafc)'
  });
  document.body.appendChild(overlay);

  const form = overlay.querySelector('#authForm');
  const submit = overlay.querySelector('#authSubmit');
  const error = overlay.querySelector('#authError');
  const createToggle = overlay.querySelector('#authCreateToggle');
  const createForm = overlay.querySelector('#authCreateForm');
  const createSubmit = overlay.querySelector('#authCreateSubmit');
  const createError = overlay.querySelector('#authCreateError');

  function messageErreurConnexion(e) {
    const messages = {
      'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
      'auth/user-not-found': 'Compte introuvable.',
      'auth/wrong-password': 'Mot de passe incorrect.',
      'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
      'auth/user-disabled': 'Ce compte a été désactivé.'
    };
    return messages[e.code] || `Connexion impossible : ${e.message}`;
  }

  function messageErreurCreation(e) {
    const messages = {
      'auth/email-already-in-use': 'Cette adresse e-mail possède déjà un compte. Utilise la zone Connexion.',
      'auth/invalid-email': 'Adresse e-mail invalide.',
      'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
      'auth/operation-not-allowed': 'La création de compte par e-mail n’est pas activée dans Firebase.'
    };
    return messages[e.code] || `Création impossible : ${e.message}`;
  }

  function afficherMessageCompte(message, couleur = '#b45309') {
    messageCompte = message;
    error.style.color = couleur;
    error.textContent = message;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageCompte = '';
    error.style.color = '#b91c1c';
    error.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Connexion…';
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await auth.signInWithEmailAndPassword(
        overlay.querySelector('#authEmail').value.trim(),
        overlay.querySelector('#authPassword').value
      );
    } catch (e) {
      error.textContent = messageErreurConnexion(e);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Se connecter';
    }
  });

  if (createToggle && createForm) {
    createToggle.addEventListener('click', () => {
      const ouvert = createForm.style.display === 'grid';
      createForm.style.display = ouvert ? 'none' : 'grid';
      createToggle.textContent = ouvert ? 'Créer mon compte agent' : 'Fermer la création de compte';
      if (!ouvert) overlay.querySelector('#authPrenom')?.focus();
    });

    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      createError.textContent = '';
      error.textContent = '';

      const prenom = overlay.querySelector('#authPrenom').value.trim();
      const nom = overlay.querySelector('#authNom').value.trim();
      const email = overlay.querySelector('#authCreateEmail').value.trim().toLowerCase();
      const motDePasse = overlay.querySelector('#authCreatePassword').value;
      const confirmation = overlay.querySelector('#authCreatePasswordConfirm').value;
      const agentId = agentLien || nettoyerIdentifiantCompte(overlay.querySelector('#authAgentId')?.value || '');

      if (!prenom || !nom || !email || !agentId) {
        createError.textContent = 'Tous les champs sont obligatoires.';
        return;
      }
      if (motDePasse.length < 6) {
        createError.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
        return;
      }
      if (motDePasse !== confirmation) {
        createError.textContent = 'Les deux mots de passe ne correspondent pas.';
        return;
      }

      creationEnCours = true;
      createSubmit.disabled = true;
      createSubmit.textContent = 'Création…';
      let utilisateurCree = null;

      try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const credential = await auth.createUserWithEmailAndPassword(email, motDePasse);
        utilisateurCree = credential.user;
        await utilisateurCree.updateProfile({ displayName: `${prenom} ${nom}`.trim() });
        await db.collection('conteneurs_comptes').doc(utilisateurCree.uid).set({
          uid: utilisateurCree.uid,
          email,
          prenom,
          nom,
          agentId,
          statut: 'pending',
          role: 'agent',
          origine: agentLien ? 'lien-agent' : 'saisie-agent',
          creeLe: firebase.firestore.FieldValue.serverTimestamp(),
          misAJourLe: firebase.firestore.FieldValue.serverTimestamp()
        });
        await auth.signOut();
        createForm.reset();
        createForm.style.display = 'none';
        createToggle.textContent = 'Créer mon compte agent';
        afficherMessageCompte('✅ Demande envoyée. Ton responsable doit maintenant valider ton compte avant la première connexion.', '#047857');
      } catch (e) {
        if (utilisateurCree && auth.currentUser && auth.currentUser.uid === utilisateurCree.uid) {
          try { await utilisateurCree.delete(); } catch (_) { try { await auth.signOut(); } catch (_) {} }
        }
        createError.textContent = messageErreurCreation(e);
      } finally {
        creationEnCours = false;
        createSubmit.disabled = false;
        createSubmit.textContent = 'Envoyer ma demande';
      }
    });
  }

  auth.onAuthStateChanged(async (user) => {
    if (creationEnCours) return;

    if (!user) {
      utilisateurLance = null;
      overlay.style.display = 'flex';
      if (messageCompte) {
        error.textContent = messageCompte;
      }
      return;
    }

    try {
      const compteSnap = await db.collection('conteneurs_comptes').doc(user.uid).get();
      if (compteSnap.exists) {
        const compte = compteSnap.data() || {};

        if (!pageAgent && (compte.role || 'agent') === 'agent') {
          afficherMessageCompte('⛔ Ce compte agent ne permet pas d’accéder à l’administration.', '#b91c1c');
          await auth.signOut();
          return;
        }

        if (pageAgent) {
          const statut = compte.statut || 'pending';

          if (statut === 'pending') {
            afficherMessageCompte('⏳ Ton compte est en attente de validation par un responsable.');
            await auth.signOut();
            return;
          }

          if (statut === 'refused') {
            afficherMessageCompte('⛔ Cette demande de compte a été refusée. Contacte ton responsable.','#b91c1c');
            await auth.signOut();
            return;
          }

          if (statut !== 'approved') {
            afficherMessageCompte('⛔ Ce compte n’est pas autorisé à accéder à l’application.','#b91c1c');
            await auth.signOut();
            return;
          }

          const compteAgentId = nettoyerIdentifiantCompte(compte.agentId || '');
          if (compteAgentId && agentLien && compteAgentId !== agentLien) {
            afficherMessageCompte(`⛔ Ce compte est rattaché à l’agent « ${compteAgentId} ». Utilise ton lien personnel.`, '#b91c1c');
            await auth.signOut();
            return;
          }

          if (compteAgentId && !agentLien) {
            const destination = new URL(location.href);
            destination.searchParams.set('agent', compteAgentId);
            location.replace(destination.href);
            return;
          }
        }
      }

      messageCompte = '';
      error.textContent = '';
      overlay.style.display = 'none';
      if (utilisateurLance !== user.uid) {
        utilisateurLance = user.uid;
        onReady(user);
      }
    } catch (e) {
      console.error(e);
      afficherMessageCompte(`Connexion impossible : ${e.message}`, '#b91c1c');
      try { await auth.signOut(); } catch (_) {}
    }
  });
}

async function deconnexion() {
  await auth.signOut();
}

function chargerScriptAdministration(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-admin-module="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.adminModule = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.body.appendChild(script);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const chemin=location.pathname;

  try {
    if (/administration\.html$/.test(chemin)) {
      await chargerScriptAdministration('comptes-agents.js');
      await chargerScriptAdministration('remplacements.js');
      await chargerScriptAdministration('agent-chantiers.js');
      await chargerScriptAdministration('rentree-auto-sortie.js');
      await chargerScriptAdministration('edition-plannings.js');
      await chargerScriptAdministration('rattrapage-rentrees-existantes.js');
      if (window.auth?.currentUser && typeof charger === 'function') {
        await charger();
      }
      return;
    }

    if (/dashboard\.html$/.test(chemin)) {
      await chargerScriptAdministration('dashboard-photos.js');
      return;
    }

    if (chemin.endsWith('/') || /index\.html$/.test(chemin)) {
      await chargerScriptAdministration('photos-pointages-agent.js');
    }
  } catch (e) {
    console.error(e);
  }
});
