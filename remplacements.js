(function(){
  const style=document.createElement('style');
  style.textContent=`
    .replacement-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
    .replacement-form select,.replacement-form input{width:100%;min-width:0}
    .replacement-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}
    .replacement-status{display:inline-block;padding:4px 8px;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:800}
    .replacement-meta{display:block;margin-top:4px;color:#64748b;font-size:12px}
    @media(max-width:760px){.replacement-form{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.className='card';
  section.style.marginTop='16px';
  section.innerHTML=`
    <h2>🔄 Remplacement temporaire d’un agent</h2>
    <p class="hint">Le titulaire reste enregistré. Pendant la période choisie, tous ses passages apparaissent sur la fiche du remplaçant, puis reviennent automatiquement au titulaire.</p>
    <div class="replacement-form">
      <select id="agentAbsent"><option value="">Choisir l’agent absent</option></select>
      <input id="remplacantNom" list="agentsConnusRemplacement" placeholder="Nom du remplaçant">
      <input id="remplacantId" placeholder="Identifiant du remplaçant, ex. karim">
      <span></span>
      <label>Début du remplacement<input id="remplacementDebut" type="date"></label>
      <label>Fin du remplacement<input id="remplacementFin" type="date"></label>
    </div>
    <datalist id="agentsConnusRemplacement"></datalist>
    <div class="replacement-actions">
      <button id="appliquerRemplacementBtn" class="ok" type="button">🔄 Appliquer à tous les chantiers de l’agent</button>
    </div>
    <div id="remplacementMessage" class="message" role="status"></div>
    <div class="table-wrap" style="margin-top:16px">
      <table>
        <thead><tr><th>Agent absent</th><th>Remplaçant</th><th>Période</th><th>Passages</th><th>État</th><th></th></tr></thead>
        <tbody id="listeRemplacements"><tr><td colspan="6" class="empty">Aucun remplacement programmé.</td></tr></tbody>
      </table>
    </div>`;

  const liensSection=document.getElementById('agents')?.closest('section');
  if(liensSection)liensSection.before(section);
  else document.querySelector('main.container')?.appendChild(section);

  const messageZone=document.getElementById('remplacementMessage');
  const appliquerBtn=document.getElementById('appliquerRemplacementBtn');
  let plannings=[];
  let agents=[];

  function message(texte,type='info'){
    messageZone.textContent=texte;
    messageZone.className=`message show ${type}`;
  }

  function dateFR(iso){
    if(!iso)return '—';
    const [a,m,j]=iso.split('-');
    return `${j}/${m}/${a}`;
  }

  function extraireAgents(data){
    const map=new Map();
    data.forEach(p=>{
      if(p.agentId)map.set(p.agentId,{agentId:p.agentId,agentNom:p.agentNom||p.agentId});
      (Array.isArray(p.remplacements)?p.remplacements:[]).forEach(r=>{
        if(r?.agentId)map.set(r.agentId,{agentId:r.agentId,agentNom:r.agentNom||r.agentId});
      });
    });
    return [...map.values()].sort((a,b)=>a.agentNom.localeCompare(b.agentNom,'fr'));
  }

  function remplirAgents(){
    agents=extraireAgents(plannings);
    const permanents=new Map();
    plannings.forEach(p=>{if(p.agentId)permanents.set(p.agentId,p.agentNom||p.agentId);});
    const select=document.getElementById('agentAbsent');
    const valeur=select.value;
    select.innerHTML='<option value="">Choisir l’agent absent</option>'+[...permanents.entries()]
      .sort((a,b)=>a[1].localeCompare(b[1],'fr'))
      .map(([id,nom])=>`<option value="${echapper(id)}">${echapper(nom)} (${echapper(id)})</option>`).join('');
    if(permanents.has(valeur))select.value=valeur;
    document.getElementById('agentsConnusRemplacement').innerHTML=agents
      .map(a=>`<option value="${echapper(a.agentNom)}">${echapper(a.agentId)}</option>`).join('');
  }

  function afficherListe(){
    const aujourdHui=dateISO();
    const groupes=new Map();
    plannings.forEach(p=>{
      (Array.isArray(p.remplacements)?p.remplacements:[]).forEach(r=>{
        if(!r||r.annule||!r.id||r.fin<aujourdHui)return;
        const g=groupes.get(r.id)||{...r,nombre:0,chantiers:new Set()};
        g.nombre++;
        g.chantiers.add(p.chantierNom||p.id);
        groupes.set(r.id,g);
      });
    });
    const liste=[...groupes.values()].sort((a,b)=>String(a.debut).localeCompare(String(b.debut)));
    document.getElementById('listeRemplacements').innerHTML=liste.map(r=>{
      const etat=r.debut<=aujourdHui&&aujourdHui<=r.fin?'En cours':'À venir';
      return `<tr>
        <td><strong>${echapper(r.agentAbsentNom||r.agentAbsentId)}</strong><br><span class="meta">${echapper(r.agentAbsentId||'')}</span></td>
        <td><strong>${echapper(r.agentNom||r.agentId)}</strong><br><span class="meta">${echapper(r.agentId||'')}</span></td>
        <td>Du ${dateFR(r.debut)} au ${dateFR(r.fin)}</td>
        <td>${r.nombre} passage${r.nombre>1?'s':''}<span class="replacement-meta">${r.chantiers.size} chantier${r.chantiers.size>1?'s':''}</span></td>
        <td><span class="replacement-status">${etat}</span></td>
        <td><button class="danger annuler-remplacement" type="button" data-id="${echapper(r.id)}">Annuler</button></td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">Aucun remplacement en cours ou à venir.</td></tr>';
    document.querySelectorAll('.annuler-remplacement').forEach(b=>b.addEventListener('click',()=>annuler(b.dataset.id)));
  }

  async function recharger(){
    const snap=await db.collection('conteneurs_plannings').get();
    plannings=[];
    snap.forEach(d=>plannings.push({id:d.id,...d.data()}));
    remplirAgents();
    afficherListe();
  }

  async function appliquer(){
    const absentId=document.getElementById('agentAbsent').value;
    const absent=agents.find(a=>a.agentId===absentId);
    const remplacantNom=document.getElementById('remplacantNom').value.trim();
    const remplacantId=nettoyerIdentifiant(document.getElementById('remplacantId').value);
    const debut=document.getElementById('remplacementDebut').value;
    const fin=document.getElementById('remplacementFin').value;

    if(!absentId||!remplacantNom||!remplacantId||!debut||!fin){message('Renseigne l’agent absent, le remplaçant et les deux dates.','error');return;}
    if(absentId===remplacantId){message('L’agent absent et le remplaçant doivent être différents.','error');return;}
    if(fin<debut){message('La date de fin doit être postérieure ou égale à la date de début.','error');return;}

    const cibles=plannings.filter(p=>p.agentId===absentId&&p.actif!==false);
    if(!cibles.length){message('Aucun passage actif n’est associé à cet agent.','error');return;}
    const conflit=cibles.some(p=>(Array.isArray(p.remplacements)?p.remplacements:[])
      .some(r=>r&&!r.annule&&!(fin<r.debut||debut>r.fin)));
    if(conflit){message('Un remplacement existe déjà sur cette période. Annule-le ou change les dates.','error');return;}

    if(!confirm(`Remplacer ${absent?.agentNom||absentId} par ${remplacantNom} sur ${cibles.length} passage${cibles.length>1?'s':''} ?`))return;
    appliquerBtn.disabled=true;
    appliquerBtn.textContent='Application en cours…';
    message('Mise à jour de tous les passages…','info');

    const remplacement={
      id:`remp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      agentAbsentId:absentId,
      agentAbsentNom:absent?.agentNom||absentId,
      agentId:remplacantId,
      agentNom:remplacantNom,
      debut,fin,creeLe:new Date().toISOString(),annule:false
    };

    try{
      const batch=db.batch();
      cibles.forEach(p=>{
        const liste=Array.isArray(p.remplacements)?[...p.remplacements]:[];
        liste.push(remplacement);
        batch.update(db.collection('conteneurs_plannings').doc(p.id),{remplacements:liste});
      });
      await batch.commit();
      message(`✅ Remplacement appliqué à ${cibles.length} passage${cibles.length>1?'s':''}.`,'success');
      document.getElementById('remplacantNom').value='';
      document.getElementById('remplacantId').value='';
      await charger();
    }catch(e){message(`Impossible d’appliquer le remplacement : ${e.message}`,'error');}
    finally{appliquerBtn.disabled=false;appliquerBtn.textContent='🔄 Appliquer à tous les chantiers de l’agent';}
  }

  async function annuler(id){
    const cibles=plannings.filter(p=>(Array.isArray(p.remplacements)?p.remplacements:[]).some(r=>r?.id===id&&!r.annule));
    if(!cibles.length||!confirm('Annuler ce remplacement ? Les passages reviendront au titulaire.'))return;
    try{
      const batch=db.batch();
      cibles.forEach(p=>{
        const liste=(Array.isArray(p.remplacements)?p.remplacements:[]).map(r=>r?.id===id?{...r,annule:true,annuleLe:new Date().toISOString()}:r);
        batch.update(db.collection('conteneurs_plannings').doc(p.id),{remplacements:liste});
      });
      await batch.commit();
      message('Le remplacement a été annulé.','success');
      await charger();
    }catch(e){message(`Annulation impossible : ${e.message}`,'error');}
  }

  afficherLiensAgents=function(data){
    const map=new Map();
    const aujourdHui=dateISO();
    function ajouter(id,nom){
      if(!id)return;
      const a=map.get(id)||{agentId:id,agentNom:nom||id,nombre:0};
      a.nombre++;if(nom)a.agentNom=nom;map.set(id,a);
    }
    data.forEach(p=>{
      ajouter(p.agentId,p.agentNom);
      const vus=new Set();
      (Array.isArray(p.remplacements)?p.remplacements:[]).forEach(r=>{
        if(r&&!r.annule&&r.fin>=aujourdHui&&r.agentId&&!vus.has(r.agentId)){ajouter(r.agentId,r.agentNom);vus.add(r.agentId);}
      });
    });
    const liste=[...map.values()].sort((a,b)=>a.agentNom.localeCompare(b.agentNom,'fr'));
    const zone=document.getElementById('agents');
    zone.innerHTML=liste.map(a=>{
      const lien=lienAgent(a.agentId);
      return `<article class="agent-link-card"><h3>${echapper(a.agentNom)}</h3>
        <div class="agent-link-id">Identifiant : <strong>${echapper(a.agentId)}</strong> · <span class="agent-count">${a.nombre} passage${a.nombre>1?'s':''}</span></div>
        <input class="agent-url" value="${echapper(lien)}" readonly onclick="this.select()">
        <div class="agent-link-row"><button class="ok copy-agent-link" type="button" data-link="${echapper(lien)}">📋 Copier le lien</button>
        <a class="btn secondary link-button" href="${echapper(lien)}" target="_blank" rel="noopener">↗ Ouvrir la page agent</a></div></article>`;
    }).join('')||'<div class="empty">Aucun agent.</div>';
    document.querySelectorAll('.copy-agent-link').forEach(b=>b.addEventListener('click',()=>copierLien(b.dataset.link,b)));
  };

  const chargerBase=charger;
  charger=async function(){
    await chargerBase();
    await recharger();
  };

  appliquerBtn.addEventListener('click',appliquer);
  document.getElementById('remplacantNom').addEventListener('change',e=>{
    const trouve=agents.find(a=>a.agentNom.toLowerCase()===e.target.value.trim().toLowerCase());
    if(trouve)document.getElementById('remplacantId').value=trouve.agentId;
  });
  document.getElementById('remplacantId').addEventListener('blur',e=>e.target.value=nettoyerIdentifiant(e.target.value));
  document.getElementById('remplacementDebut').value=dateISO();
  document.getElementById('remplacementFin').value=dateISO();
  setTimeout(()=>{if(window.auth?.currentUser)recharger().catch(e=>message(e.message,'error'));},0);
})();
