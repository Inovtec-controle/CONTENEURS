function afficherConnexion(onReady) {
  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML = `
    <div style="width:min(92%,380px);background:white;border-radius:22px;padding:24px;box-shadow:0 20px 55px rgba(15,23,42,.22)">
      <div style="font-size:34px;text-align:center;margin-bottom:8px">🔐</div>
      <h2 style="text-align:center;margin:0 0 6px">Connexion</h2>
      <p style="text-align:center;color:#64748b;font-size:13px;margin:0 0 18px">Utilise ton compte Firebase habituel.</p>
      <form id="authForm" style="display:grid;gap:10px">
        <input id="authEmail" type="email" autocomplete="username" placeholder="Adresse e-mail" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <input id="authPassword" type="password" autocomplete="current-password" placeholder="Mot de passe" required style="padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:15px">
        <button id="authSubmit" type="submit" class="ok" style="width:100%;padding:12px">Se connecter</button>
        <div id="authError" style="min-height:18px;color:#b91c1c;font-size:12px;text-align:center"></div>
      </form>
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
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
      const messages = {
        'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
        'auth/user-not-found': 'Compte introuvable.',
        'auth/wrong-password': 'Mot de passe incorrect.',
        'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.'
      };
      error.textContent = messages[e.code] || `Connexion impossible : ${e.message}`;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Se connecter';
    }
  });

  let lance = false;
  auth.onAuthStateChanged((user) => {
    if (user) {
      overlay.style.display = 'none';
      if (!lance) {
        lance = true;
        onReady(user);
      }
    } else {
      lance = false;
      overlay.style.display = 'flex';
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
  if (!/administration\.html$/.test(location.pathname)) return;

  try {
    await chargerScriptAdministration('remplacements.js');
    await chargerScriptAdministration('agent-chantiers.js');
    await chargerScriptAdministration('edition-plannings.js');
    if (window.auth?.currentUser && typeof charger === 'function') {
      await charger();
    }
  } catch (e) {
    console.error(e);
  }
});
