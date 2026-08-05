(function(){
  if(window.__agentChantiersModuleCharge)return;
  window.__agentChantiersModuleCharge=true;

  const style=document.createElement('style');
  style.textContent=`
    .agent-sites-button{display:inline-flex;align-items:center;justify-content:center}
    .agent-sites-modal{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.58)}
    .agent-sites-modal.show{display:flex}
    .agent-sites-dialog{width:min(960px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 70px rgba(15,23,42,.28)}
    .agent-sites-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px;border-bottom:1px solid #e2e8f0;background:#fff;border-radius:22px 22px 0 0}
    .agent-sites-head h2{margin:0 0 4px}
    .agent-sites-head p{margin:0;color:#64748b;font-size:13px}
    .agent-sites-close{flex:0 0 auto;background:#f8fafc;color:#334155;border:1px solid #cbd5e1}
    .agent-sites-body{padding:18px 20px 22px}
    .agent-sites-summary{margin-bottom:14px;padding:11px 13px;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:700}
    .agent-site-card{padding:14px;border:1px solid #dbe4df;border-radius:15px;background:#f8fbf9;margin-top:10px}
    .agent-site-card h3{margin:0 0 3px;font-size:17px}
    .agent-site-address{color:#64748b;font-size:12px;margin-bottom:10px}
    .agent-passage-list{display:flex;flex-direction:column;gap:8px}
    .agent-passage-row{display:grid;grid-template-columns:1fr 1fr .8fr 1fr 1.2fr;gap:8px;align-items:center;padding:9px 10px;border-radius:11px;background:#fff;border:1px solid #e2e8f0;font-size:12px}
    .agent-passage-action{font-weight:800}
    .agent-passage-replacement{grid-column:1/-1;padding-top:6px;border-top:1px dashed #fed7aa;color:#9a3412;font-weight:700}
    .agent-sites-empty{padding:24px;text-align:center;color:#64748b}
    @media(max-width:720px){
      .agent-sites-dialog{max-height:94vh}
      .agent-sites-head{padding:16px}
      .agent-sites-body{padding:14px 16px 18px}
      .agent-passage-row{grid-template-columns:1fr 1fr}
      .agent-passage-row .wide-mobile{grid-column:1/-1}
      .agent-link-row .agent-sites-button{width:100%}
    }
  `;
  document.head.appendChild(style);

  const modal=document.createElement('div');
  modal.id='agentSitesModal';
  modal.className='agent-sites-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <div class="agent-sites-dialog" role="dialog" aria-modal="true" aria-labelledby="agentSitesTitle">
      <div class="agent-sites-head">
        <div>
          <h2 id="agentSitesTitle">🏢 Chantiers affectés</h2>
          <p id="agentSitesSubtitle"></p>
        </div>
        <button id="agentSitesClose" class="agent-sites-close" type="button">✕ Fermer</button>
      </div>
      <div id="agentSitesBody" class="agent-sites-body"></div>
    </div>`;
  document.body.appendChild(modal);

  let planningsAgents=[];
  const aujourdHui=()=>dateISO();

  function dateFR(iso){
    if(!iso)return '—';
    const [a,m,j]=String(iso).split('-');
    return a&&m&&j?`${j}/${m}/${a}`:iso;
  }

  function statutFrequence(valeur){
    if(valeur==='paire')return 'Semaines paires';
    if(valeur==='impaire')return 'Semaines impaires';
    return 'Toutes les semaines';
  }

  function passagesPourAgent(agentId){
    const resultat=[];
    const maintenant=aujourdHui();
    planningsAgents.forEach(p=>{
      if(p.actif===false)return;
      if(p.agentId===agentId){
        resultat.push({...p,affectationType:'titulaire'});
      }
      (Array.isArray(p.remplacements)?p.remplacements:[]).forEach(r=>{
        if(!r||r.annule||r.agentId!==agentId||r.fin<maintenant)return;
        resultat.push({...p,affectationType:'remplacement',remplacement:r});
      });
    });
    return resultat.sort((a,b)=>
      String(a.chantierNom||'').localeCompare(String(b.chantierNom||''),'fr')
      ||String(a.jour||'').localeCompare(String(b.jour||''),'fr')
      ||String(a.heureDebut||'').localeCompare(String(b.heureDebut||''))
    );
  }

  function ouvrirChantiers(agentId,agentNom){
    const passages=passagesPourAgent(agentId);
    const groupes=new Map();
    passages.forEach(p=>{
      const cle=`${p.chantierNom||''}|${p.adresse||''}`;
      const groupe=groupes.get(cle)||{chantierNom:p.chantierNom||'Chantier sans nom',adresse:p.adresse||'',passages:[]};
      groupe.passages.push(p);
      groupes.set(cle,groupe);
    });

    document.getElementById('agentSitesTitle').textContent=`🏢 Chantiers de ${agentNom||agentId}`;
    document.getElementById('agentSitesSubtitle').textContent=`Identifiant : ${agentId}`;
    const body=document.getElementById('agentSitesBody');

    if(!passages.length){
      body.innerHTML='<div class="agent-sites-empty">Aucun chantier actif n’est affecté à cet agent.</div>';
    }else{
      body.innerHTML=`
        <div class="agent-sites-summary">${groupes.size} chantier${groupes.size>1?'s':''} · ${passages.length} passage${passages.length>1?'s':''} affecté${passages.length>1?'s':''}</div>
        ${[...groupes.values()].map(g=>`<article class="agent-site-card">
          <h3>${echapper(g.chantierNom)}</h3>
          <div class="agent-site-address">${echapper(g.adresse||'Adresse non renseignée')}</div>
          <div class="agent-passage-list">
            ${g.passages.map(p=>`<div class="agent-passage-row">
              <span><strong>${echapper(p.jour||'—')}</strong></span>
              <span class="agent-passage-action">${p.action==='sortie'?'⬆️ Sortie':'⬇️ Rentrée'}</span>
              <span>${echapper(p.typeConteneur||'—')}</span>
              <span>${echapper(p.heureDebut||'—')}–${echapper(p.heureFin||'—')}</span>
              <span class="wide-mobile">${echapper(statutFrequence(p.frequence))}</span>
              ${p.affectationType==='remplacement'?`<span class="agent-passage-replacement">🔄 Remplacement de ${echapper(p.remplacement?.agentAbsentNom||p.agentNom||p.agentId)} du ${dateFR(p.remplacement?.debut)} au ${dateFR(p.remplacement?.fin)}</span>`:''}
            </div>`).join('')}
          </div>
        </article>`).join('')}`;
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }

  function fermerChantiers(){
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }

  document.getElementById('agentSitesClose').addEventListener('click',fermerChantiers);
  modal.addEventListener('click',e=>{if(e.target===modal)fermerChantiers();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('show'))fermerChantiers();});

  afficherLiensAgents=function(data){
    planningsAgents=Array.isArray(data)?data:[];
    const map=new Map();
    const dateDuJour=aujourdHui();

    function ajouter(id,nom){
      if(!id)return;
      const a=map.get(id)||{agentId:id,agentNom:nom||id,nombre:0};
      a.nombre++;
      if(nom)a.agentNom=nom;
      map.set(id,a);
    }

    planningsAgents.forEach(p=>{
      if(p.actif!==false)ajouter(p.agentId,p.agentNom);
      const vus=new Set();
      (Array.isArray(p.remplacements)?p.remplacements:[]).forEach(r=>{
        if(r&&!r.annule&&r.fin>=dateDuJour&&r.agentId&&!vus.has(r.agentId)){
          ajouter(r.agentId,r.agentNom);
          vus.add(r.agentId);
        }
      });
    });

    const liste=[...map.values()].sort((a,b)=>a.agentNom.localeCompare(b.agentNom,'fr'));
    const zone=document.getElementById('agents');
    zone.innerHTML=liste.map(a=>{
      const lien=lienAgent(a.agentId);
      return `<article class="agent-link-card">
        <h3>${echapper(a.agentNom)}</h3>
        <div class="agent-link-id">Identifiant : <strong>${echapper(a.agentId)}</strong> · <span class="agent-count">${a.nombre} passage${a.nombre>1?'s':''}</span></div>
        <input class="agent-url" value="${echapper(lien)}" readonly onclick="this.select()">
        <div class="agent-link-row">
          <button class="ok copy-agent-link" type="button" data-link="${echapper(lien)}">📋 Copier le lien</button>
          <a class="btn secondary link-button" href="${echapper(lien)}" target="_blank" rel="noopener">↗ Ouvrir la page agent</a>
          <button class="btn secondary agent-sites-button" type="button" data-agent-id="${echapper(a.agentId)}" data-agent-nom="${echapper(a.agentNom)}">🏢 Voir les chantiers</button>
        </div>
      </article>`;
    }).join('')||'<div class="empty">Aucun agent.</div>';

    document.querySelectorAll('.copy-agent-link').forEach(b=>b.addEventListener('click',()=>copierLien(b.dataset.link,b)));
    document.querySelectorAll('.agent-sites-button').forEach(b=>b.addEventListener('click',()=>ouvrirChantiers(b.dataset.agentId,b.dataset.agentNom)));
  };
})();
