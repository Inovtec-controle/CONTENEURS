(function(){
  if(document.getElementById('generationRentreesSection'))return;

  const joursSuivants={
    lundi:'mardi',mardi:'mercredi',mercredi:'jeudi',jeudi:'vendredi',
    vendredi:'samedi',samedi:'dimanche',dimanche:'lundi'
  };

  const style=document.createElement('style');
  style.textContent=`
    .retours-form{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:10px;align-items:end;margin-top:14px}
    .retours-form input{width:100%}
    .retours-agent-preview{margin-top:6px;color:#64748b;font-size:12px}
    .retours-summary{margin-top:12px;padding:12px 14px;border-radius:12px;background:#f8fafc;color:#334155;font-size:13px}
    .retours-summary strong{color:#0f172a}
    .retours-note{margin:7px 0 0;color:#64748b;font-size:12px}
    @media(max-width:760px){.retours-form{grid-template-columns:1fr}.retours-form button{width:100%}}
  `;
  document.head.appendChild(style);

  const section=document.createElement('section');
  section.id='generationRentreesSection';
  section.className='card';
  section.style.marginTop='16px';
  section.innerHTML=`
    <h2>↩️ Programmer les rentrées du lendemain</h2>
    <p class="hint">L’application reprend toutes les sorties actives et crée automatiquement la rentrée correspondante le lendemain. Les rentrées déjà programmées ne sont pas recréées.</p>
    <div class="retours-form">
      <label>Agent chargé des rentrées
        <input id="agentRetourNom" list="agentsRetourConnus" placeholder="Ex. Karim" autocomplete="off">
        <datalist id="agentsRetourConnus"></datalist>
        <div id="agentRetourIdApercu" class="retours-agent-preview">Identifiant automatique : —</div>
      </label>
      <button id="genererRentreesBtn" class="ok" type="button">↩️ Créer les rentrées manquantes</button>
    </div>
    <div id="retoursResume" class="retours-summary">Analyse des sorties en cours…</div>
    <div id="retoursMessage" class="message" role="status"></div>
    <p class="retours-note">Les horaires sont repris d’une rentrée déjà connue sur le même chantier lorsqu’elle existe. Sinon, ils restent non renseignés.</p>`;

  const remplacementSection=[...document.querySelectorAll('section.card')]
    .find(s=>s.textContent.includes('Remplacement temporaire'));
  const liensSection=document.getElementById('agents')?.closest('section');
  if(remplacementSection)remplacementSection.before(section);
  else if(liensSection)liensSection.before(section);
  else document.querySelector('main.container')?.appendChild(section);

  const nomInput=document.getElementById('agentRetourNom');
  const datalist=document.getElementById('agentsRetourConnus');
  const apercu=document.getElementById('agentRetourIdApercu');
  const bouton=document.getElementById('genererRentreesBtn');
  const resume=document.getElementById('retoursResume');
  const messageZone=document.getElementById('retoursMessage');

  let plannings=[];
  let agents=[];
  let candidats=[];
  let doublons=0;

  function afficherMessage(texte,type='info'){
    messageZone.textContent=texte;
    messageZone.className=`message show ${type}`;
  }

  function normaliserTexte(texte=''){
    return String(texte).trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'');
  }

  function identifiantDepuisNom(nom){
    const exact=agents.find(a=>normaliserTexte(a.agentNom)===normaliserTexte(nom));
    return exact?.agentId||nettoyerIdentifiant(nom);
  }

  function nomAgentConnu(nom){
    return agents.find(a=>normaliserTexte(a.agentNom)===normaliserTexte(nom))?.agentNom||nom.trim();
  }

  function frequenceLendemain(sortie){
    const frequence=sortie.frequence||'toutes';
    if(sortie.jour!=='dimanche')return frequence;
    if(frequence==='paire')return 'impaire';
    if(frequence==='impaire')return 'paire';
    return frequence;
  }

  function memeChantier(a,b){
    return normaliserTexte(a.chantierNom)===normaliserTexte(b.chantierNom)
      && normaliserTexte(a.typeConteneur)===normaliserTexte(b.typeConteneur);
  }

  function horaireModele(sortie){
    const modele=plannings.find(p=>p.action==='rentree'&&p.actif!==false&&memeChantier(p,sortie)
      &&(p.heureDebut||p.heureFin));
    return {heureDebut:modele?.heureDebut||'',heureFin:modele?.heureFin||''};
  }

  function existeDeja(sortie,jour,frequence){
    return plannings.some(p=>{
      if(p.action!=='rentree'||p.actif===false)return false;
      if(p.sourceSortieId===sortie.id)return true;
      return memeChantier(p,sortie)&&p.jour===jour&&(p.frequence||'toutes')===frequence;
    });
  }

  function extraireAgents(){
    const map=new Map();
    function ajouter(id,nom){
      if(!id)return;
      const existant=map.get(id)||{agentId:id,agentNom:nom||id};
      if(nom)existant.agentNom=nom;
      map.set(id,existant);
    }
    plannings.forEach(p=>{
      ajouter(p.agentId,p.agentNom);
      (Array.isArray(p.remplacements)?p.remplacements:[]).forEach(r=>{
        if(r&&!r.annule)ajouter(r.agentId,r.agentNom);
      });
    });
    agents=[...map.values()].sort((a,b)=>a.agentNom.localeCompare(b.agentNom,'fr'));
    datalist.innerHTML=agents.map(a=>`<option value="${echapper(a.agentNom)}"></option>`).join('');
  }

  function preparerCandidats(){
    candidats=[];
    doublons=0;
    const sorties=plannings.filter(p=>p.action==='sortie'&&p.actif!==false);
    sorties.forEach(sortie=>{
      const jour=joursSuivants[sortie.jour];
      if(!jour)return;
      const frequence=frequenceLendemain(sortie);
      if(existeDeja(sortie,jour,frequence)){doublons++;return;}
      candidats.push({sortie,jour,frequence,...horaireModele(sortie)});
    });
    resume.innerHTML=`<strong>${sorties.length}</strong> sortie${sorties.length>1?'s':''} active${sorties.length>1?'s':''} analysée${sorties.length>1?'s':''} · <strong>${candidats.length}</strong> rentrée${candidats.length>1?'s':''} à créer · <strong>${doublons}</strong> déjà programmée${doublons>1?'s':''}.`;
    bouton.disabled=!candidats.length;
  }

  async function analyser(){
    try{
      const snap=await db.collection('conteneurs_plannings').get();
      plannings=[];
      snap.forEach(d=>plannings.push({id:d.id,...d.data()}));
      extraireAgents();
      preparerCandidats();
    }catch(e){
      resume.textContent=`Analyse impossible : ${e.message}`;
      bouton.disabled=true;
    }
  }

  function mettreAJourApercu(){
    const id=identifiantDepuisNom(nomInput.value);
    apercu.textContent=`Identifiant automatique : ${id||'—'}`;
  }

  async function enregistrerParLots(documents){
    for(let debut=0;debut<documents.length;debut+=400){
      const lot=db.batch();
      documents.slice(debut,debut+400).forEach(data=>{
        const ref=db.collection('conteneurs_plannings').doc();
        lot.set(ref,data);
      });
      await lot.commit();
    }
  }

  async function generer(){
    const nomSaisi=nomInput.value.trim();
    const agentId=identifiantDepuisNom(nomSaisi);
    const agentNom=nomAgentConnu(nomSaisi);
    if(!agentNom||!agentId){
      afficherMessage('Indique le nom de l’agent chargé de rentrer les conteneurs.','error');
      return;
    }

    await analyser();
    if(!candidats.length){
      afficherMessage('Toutes les rentrées du lendemain sont déjà programmées.','success');
      return;
    }

    if(!confirm(`Créer ${candidats.length} rentrée${candidats.length>1?'s':''} du lendemain pour ${agentNom} ?`))return;

    bouton.disabled=true;
    bouton.textContent='Création en cours…';
    afficherMessage('Création des rentrées manquantes…','info');

    const maintenant=new Date().toISOString();
    const documents=candidats.map(c=>({
      chantierNom:c.sortie.chantierNom||'',
      chantierGroupeId:c.sortie.chantierGroupeId||'',
      adresse:c.sortie.adresse||'',
      agentNom,
      agentId,
      action:'rentree',
      typeConteneur:c.sortie.typeConteneur||'OM',
      jour:c.jour,
      heureDebut:c.heureDebut,
      heureFin:c.heureFin,
      frequence:c.frequence,
      actif:true,
      sourceSortieId:c.sortie.id,
      genereDepuisSortie:true,
      genereLe:maintenant,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    }));

    try{
      await enregistrerParLots(documents);
      afficherMessage(`✅ ${documents.length} rentrée${documents.length>1?'s':''} créée${documents.length>1?'s':''} pour ${agentNom}.`,'success');
      await analyser();
      if(typeof charger==='function')await charger();
    }catch(e){
      afficherMessage(`Impossible de créer les rentrées : ${e.message}`,'error');
    }finally{
      bouton.textContent='↩️ Créer les rentrées manquantes';
      bouton.disabled=!candidats.length;
    }
  }

  nomInput.addEventListener('input',mettreAJourApercu);
  nomInput.addEventListener('change',mettreAJourApercu);
  bouton.addEventListener('click',generer);

  if(window.auth?.currentUser)analyser();
  window.auth?.onAuthStateChanged(user=>{if(user)analyser();});
})();
