(function(){
  if(window.editionPlanningsChargee)return;
  window.editionPlanningsChargee=true;

  const joursEdition=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const frequencesEdition=[
    ['toutes','Toutes les semaines'],
    ['paire','Semaines paires'],
    ['impaire','Semaines impaires']
  ];
  const planningsEdition=new Map();

  const style=document.createElement('style');
  style.textContent=`
    .planning-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
    .edit-planning-row td{vertical-align:top;background:#f8fafc}
    .edit-planning-fields{display:grid;gap:7px;min-width:150px}
    .edit-planning-fields input,.edit-planning-fields select{width:100%;min-width:120px;padding:8px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font:inherit}
    .edit-planning-fields small{color:#64748b;font-size:11px}
    .edit-planning-actions{display:grid;gap:7px;min-width:115px}
    .edit-planning-error{margin-top:8px;padding:8px;border-radius:9px;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:700}
    @media(max-width:760px){
      .edit-planning-row td{min-width:170px}
      .planning-actions{min-width:150px}
    }
  `;
  document.head.appendChild(style);

  function optionsEdition(options,valeur){
    return options.map(option=>{
      const code=Array.isArray(option)?option[0]:option;
      const libelle=Array.isArray(option)?option[1]:option;
      return `<option value="${echapper(code)}"${code===valeur?' selected':''}>${echapper(libelle)}</option>`;
    }).join('');
  }

  function idDepuisBoutonSupprimer(bouton){
    const code=bouton.getAttribute('onclick')||'';
    const resultat=code.match(/supprimer\(['\"]([^'\"]+)['\"]\)/);
    return resultat?resultat[1]:'';
  }

  async function rechargerDonneesEdition(){
    const snap=await db.collection('conteneurs_plannings').get();
    planningsEdition.clear();
    snap.forEach(d=>planningsEdition.set(d.id,{id:d.id,...d.data()}));
  }

  function installerBoutonsEdition(){
    const liste=document.getElementById('liste');
    if(!liste)return;

    liste.querySelectorAll('tr').forEach(ligne=>{
      const boutonSupprimer=ligne.querySelector('button.danger[onclick*="supprimer"]');
      if(!boutonSupprimer)return;
      const id=idDepuisBoutonSupprimer(boutonSupprimer);
      if(!id||ligne.querySelector('.edit-planning-button'))return;

      const cellule=boutonSupprimer.closest('td');
      cellule.classList.add('planning-actions');
      const bouton=document.createElement('button');
      bouton.className='btn secondary edit-planning-button';
      bouton.type='button';
      bouton.textContent='✏️ Modifier';
      bouton.addEventListener('click',()=>ouvrirEdition(id,ligne));
      cellule.insertBefore(bouton,boutonSupprimer);
    });
  }

  async function actualiserEdition(){
    await rechargerDonneesEdition();
    installerBoutonsEdition();
  }

  function ouvrirEdition(id,ligne){
    const p=planningsEdition.get(id);
    if(!p)return;
    if(document.querySelector('.edit-planning-row')){
      alert('Termine ou annule la modification déjà ouverte avant d’en modifier une autre.');
      return;
    }

    ligne.classList.add('edit-planning-row');
    ligne.dataset.planningId=id;
    ligne.innerHTML=`
      <td>
        <div class="edit-planning-fields">
          <input class="edit-chantier" value="${echapper(p.chantierNom||'')}" placeholder="Nom du chantier" aria-label="Nom du chantier">
          <input class="edit-adresse" value="${echapper(p.adresse||'')}" placeholder="Adresse" aria-label="Adresse">
        </div>
      </td>
      <td>
        <div class="edit-planning-fields">
          <select class="edit-action" aria-label="Action">
            <option value="sortie"${p.action==='sortie'?' selected':''}>Sortie</option>
            <option value="rentree"${p.action==='rentree'?' selected':''}>Rentrée</option>
          </select>
        </div>
      </td>
      <td>
        <div class="edit-planning-fields">
          <select class="edit-type" aria-label="Type de conteneur">
            <option value="OM"${p.typeConteneur==='OM'?' selected':''}>OM</option>
            <option value="TRI"${p.typeConteneur==='TRI'?' selected':''}>TRI</option>
            <option value="OM/TRI"${p.typeConteneur==='OM/TRI'?' selected':''}>OM/TRI</option>
          </select>
        </div>
      </td>
      <td>
        <div class="edit-planning-fields">
          <select class="edit-jour" aria-label="Jour">${optionsEdition(joursEdition,p.jour||'lundi')}</select>
          <select class="edit-frequence" aria-label="Fréquence">${optionsEdition(frequencesEdition,p.frequence||'toutes')}</select>
        </div>
      </td>
      <td>
        <div class="edit-planning-fields">
          <input class="edit-agent-nom" value="${echapper(p.agentNom||p.agentId||'')}" placeholder="Nom de l’agent" aria-label="Nom de l’agent">
          <input class="edit-agent-id" value="${echapper(p.agentId||'')}" placeholder="Identifiant agent" aria-label="Identifiant agent">
          <small>L’identifiant est utilisé dans le lien de la fiche agent.</small>
        </div>
      </td>
      <td>
        <div class="edit-planning-fields">
          <input class="edit-debut" type="time" value="${echapper(p.heureDebut||'')}" aria-label="Heure de début">
          <input class="edit-fin" type="time" value="${echapper(p.heureFin||'')}" aria-label="Heure de fin">
        </div>
      </td>
      <td>
        <div class="edit-planning-actions">
          <button class="ok edit-save" type="button">💾 Enregistrer</button>
          <button class="btn secondary edit-cancel" type="button">Annuler</button>
        </div>
        <div class="edit-planning-error" hidden></div>
      </td>`;

    ligne.querySelector('.edit-agent-id').addEventListener('blur',e=>{
      e.target.value=nettoyerIdentifiant(e.target.value);
    });
    ligne.querySelector('.edit-cancel').addEventListener('click',()=>charger());
    ligne.querySelector('.edit-save').addEventListener('click',()=>enregistrerEdition(id,ligne));
  }

  function lireEdition(ligne){
    const ancien=planningsEdition.get(ligne.dataset.planningId)||{};
    const agentNom=ligne.querySelector('.edit-agent-nom').value.trim();
    const agentId=nettoyerIdentifiant(ligne.querySelector('.edit-agent-id').value);
    const remplacements=Array.isArray(ancien.remplacements)
      ? ancien.remplacements.map(r=>r?{...r,agentAbsentId:agentId,agentAbsentNom:agentNom||agentId}:r)
      : ancien.remplacements;

    return {
      chantierNom:ligne.querySelector('.edit-chantier').value.trim(),
      adresse:ligne.querySelector('.edit-adresse').value.trim(),
      action:ligne.querySelector('.edit-action').value,
      typeConteneur:ligne.querySelector('.edit-type').value,
      jour:ligne.querySelector('.edit-jour').value,
      frequence:ligne.querySelector('.edit-frequence').value,
      agentNom:agentNom||agentId,
      agentId,
      heureDebut:ligne.querySelector('.edit-debut').value,
      heureFin:ligne.querySelector('.edit-fin').value,
      ...(remplacements!==undefined?{remplacements}:{}),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function afficherErreurEdition(ligne,texte){
    const zone=ligne.querySelector('.edit-planning-error');
    zone.textContent=texte;
    zone.hidden=false;
  }

  function doublonEdition(id,data){
    return [...planningsEdition.values()].some(p=>{
      if(p.id===id||p.actif===false)return false;
      return String(p.chantierNom||'').trim().toLowerCase()===data.chantierNom.toLowerCase()
        && String(p.action||'')===data.action
        && String(p.typeConteneur||'')===data.typeConteneur
        && String(p.jour||'')===data.jour
        && String(p.frequence||'toutes')===data.frequence
        && String(p.agentId||'')===data.agentId
        && String(p.heureDebut||'')===data.heureDebut
        && String(p.heureFin||'')===data.heureFin;
    });
  }

  async function enregistrerEdition(id,ligne){
    const data=lireEdition(ligne);
    const bouton=ligne.querySelector('.edit-save');
    const annuler=ligne.querySelector('.edit-cancel');

    if(!data.chantierNom){afficherErreurEdition(ligne,'Le nom du chantier est obligatoire.');return;}
    if(!data.agentId){afficherErreurEdition(ligne,'L’identifiant de l’agent est obligatoire.');return;}
    if(!joursEdition.includes(data.jour)){afficherErreurEdition(ligne,'Le jour sélectionné est incorrect.');return;}
    if(!['sortie','rentree'].includes(data.action)){afficherErreurEdition(ligne,'L’action sélectionnée est incorrecte.');return;}
    if(!['OM','TRI','OM/TRI'].includes(data.typeConteneur)){afficherErreurEdition(ligne,'Le type de conteneur est incorrect.');return;}
    if(!['toutes','paire','impaire'].includes(data.frequence)){afficherErreurEdition(ligne,'La fréquence sélectionnée est incorrecte.');return;}
    if(data.heureDebut&&data.heureFin&&data.heureFin<=data.heureDebut){
      afficherErreurEdition(ligne,'L’heure de fin doit être après l’heure de début.');
      return;
    }
    if(doublonEdition(id,data)){
      afficherErreurEdition(ligne,'Une programmation identique existe déjà.');
      return;
    }

    bouton.disabled=true;
    annuler.disabled=true;
    bouton.textContent='Enregistrement…';

    try{
      await db.collection('conteneurs_plannings').doc(id).update(data);
      if(typeof afficherMessage==='function')afficherMessage('✅ La programmation a été modifiée.','success');
      await charger();
    }catch(e){
      bouton.disabled=false;
      annuler.disabled=false;
      bouton.textContent='💾 Enregistrer';
      afficherErreurEdition(ligne,`Modification impossible : ${e.message}`);
    }
  }

  const chargerAvantEdition=charger;
  charger=async function(){
    await chargerAvantEdition();
    await actualiserEdition();
  };

  if(window.auth?.currentUser)actualiserEdition().catch(console.error);
})();
