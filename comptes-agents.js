(function(){
  if(window.comptesAgentsModuleCharge)return;
  window.comptesAgentsModuleCharge=true;

  const style=document.createElement('style');
  style.textContent=`
    .accounts-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .accounts-badge{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 9px;border-radius:999px;background:#fef3c7;color:#92400e;font-weight:800;font-size:12px}
    .accounts-list{display:grid;gap:10px;margin-top:14px}
    .account-request{border:1px solid #dbe4df;border-radius:15px;padding:13px;background:#f8fbf9}
    .account-request.pending{border-color:#f59e0b;background:#fffbeb}
    .account-request.approved{border-color:#86efac;background:#f0fdf4}
    .account-request.refused{border-color:#fecaca;background:#fef2f2}
    .account-request-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .account-request h3{margin:0;font-size:16px}
    .account-meta{margin-top:4px;color:#64748b;font-size:12px;line-height:1.45}
    .account-status{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}
    .account-status.pending{background:#fef3c7;color:#92400e}.account-status.approved{background:#dcfce7;color:#166534}.account-status.refused{background:#fee2e2;color:#991b1b}
    .account-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
    .account-history{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:12px}
    .account-history summary{cursor:pointer;font-weight:800;color:#475569}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.className='card';
  section.id='comptesAgentsSection';
  section.style.marginBottom='16px';
  section.innerHTML=`
    <div class="accounts-head">
      <div>
        <h2 style="margin:0">👤 Comptes agents à valider</h2>
        <p class="hint">Un agent qui crée son compte reste bloqué tant que tu n’as pas validé sa demande.</p>
      </div>
      <span id="accountsPendingCount" class="accounts-badge">0</span>
    </div>
    <div id="accountsPending" class="accounts-list"><div class="empty">Connexion en cours…</div></div>
    <details id="accountsHistoryBlock" class="account-history" style="display:none">
      <summary>Voir les comptes déjà traités</summary>
      <div id="accountsHistory" class="accounts-list"></div>
    </details>`;

  const main=document.querySelector('main.container');
  const premiereSection=main?.querySelector('section.card');
  if(main){
    if(premiereSection) main.insertBefore(section,premiereSection);
    else main.appendChild(section);
  }

  const pendingZone=section.querySelector('#accountsPending');
  const historyZone=section.querySelector('#accountsHistory');
  const historyBlock=section.querySelector('#accountsHistoryBlock');
  const count=section.querySelector('#accountsPendingCount');
  let stopEcoute=null;

  function echapperCompte(texte=''){
    return String(texte).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function statutLibelle(statut){
    if(statut==='approved')return '✅ Validé';
    if(statut==='refused')return '⛔ Refusé';
    return '⏳ En attente';
  }

  function nomCompte(compte){
    return [compte.prenom,compte.nom].filter(Boolean).join(' ') || compte.email || 'Compte agent';
  }

  function carteCompte(compte,id,avecActions){
    const statut=compte.statut||'pending';
    const boutons=avecActions?`
      <div class="account-actions">
        <button class="ok account-approve" type="button" data-id="${echapperCompte(id)}">✅ Valider le compte</button>
        <button class="danger account-refuse" type="button" data-id="${echapperCompte(id)}">Refuser</button>
      </div>`:'';
    return `<article class="account-request ${echapperCompte(statut)}">
      <div class="account-request-top">
        <div>
          <h3>${echapperCompte(nomCompte(compte))}</h3>
          <div class="account-meta">${echapperCompte(compte.email||'')}</div>
          <div class="account-meta"><strong>Identifiant agent :</strong> ${echapperCompte(compte.agentId||'Non renseigné')}</div>
        </div>
        <span class="account-status ${echapperCompte(statut)}">${statutLibelle(statut)}</span>
      </div>
      ${boutons}
    </article>`;
  }

  function brancherBoutons(){
    section.querySelectorAll('.account-approve').forEach(btn=>btn.addEventListener('click',()=>validerCompte(btn.dataset.id,btn)));
    section.querySelectorAll('.account-refuse').forEach(btn=>btn.addEventListener('click',()=>refuserCompte(btn.dataset.id,btn)));
  }

  function afficherComptes(docs){
    const demandes=[];
    const historique=[];
    docs.forEach(({id,data})=>{
      if((data.statut||'pending')==='pending') demandes.push({id,data});
      else historique.push({id,data});
    });

    demandes.sort((a,b)=>nomCompte(a.data).localeCompare(nomCompte(b.data),'fr'));
    historique.sort((a,b)=>nomCompte(a.data).localeCompare(nomCompte(b.data),'fr'));
    count.textContent=String(demandes.length);

    pendingZone.innerHTML=demandes.length
      ? demandes.map(item=>carteCompte(item.data,item.id,true)).join('')
      : '<div class="empty">✅ Aucune demande de compte en attente.</div>';

    if(historique.length){
      historyBlock.style.display='block';
      historyZone.innerHTML=historique.map(item=>carteCompte(item.data,item.id,false)).join('');
    }else{
      historyBlock.style.display='none';
      historyZone.innerHTML='';
    }
    brancherBoutons();
  }

  async function validerCompte(id,bouton){
    if(!id)return;
    bouton.disabled=true;
    const ancien=bouton.textContent;
    bouton.textContent='Validation…';
    try{
      await db.collection('conteneurs_comptes').doc(id).update({
        statut:'approved',
        valideLe:firebase.firestore.FieldValue.serverTimestamp(),
        validePar:auth.currentUser?.email||'',
        misAJourLe:firebase.firestore.FieldValue.serverTimestamp()
      });
    }catch(e){
      alert(`Validation impossible : ${e.message}`);
      bouton.disabled=false;
      bouton.textContent=ancien;
    }
  }

  async function refuserCompte(id,bouton){
    if(!id)return;
    if(!confirm('Refuser cette demande de compte ?'))return;
    bouton.disabled=true;
    const ancien=bouton.textContent;
    bouton.textContent='Refus…';
    try{
      await db.collection('conteneurs_comptes').doc(id).update({
        statut:'refused',
        refuseLe:firebase.firestore.FieldValue.serverTimestamp(),
        refusePar:auth.currentUser?.email||'',
        misAJourLe:firebase.firestore.FieldValue.serverTimestamp()
      });
    }catch(e){
      alert(`Refus impossible : ${e.message}`);
      bouton.disabled=false;
      bouton.textContent=ancien;
    }
  }

  function demarrerEcoute(){
    if(stopEcoute)return;
    stopEcoute=db.collection('conteneurs_comptes').onSnapshot(snap=>{
      const docs=[];
      snap.forEach(doc=>docs.push({id:doc.id,data:doc.data()||{}}));
      afficherComptes(docs);
    },e=>{
      console.error(e);
      pendingZone.innerHTML=`<div class="empty">Impossible de charger les demandes : ${echapperCompte(e.message)}</div>`;
    });
  }

  auth.onAuthStateChanged(user=>{
    if(user){
      demarrerEcoute();
    }else if(stopEcoute){
      stopEcoute();
      stopEcoute=null;
      pendingZone.innerHTML='<div class="empty">Connexion requise.</div>';
      count.textContent='0';
    }
  });
})();
