(function(){
  if(window.rattrapageRentreesExistantesCharge)return;
  window.rattrapageRentreesExistantesCharge=true;

  const joursSuivants={
    lundi:'mardi',
    mardi:'mercredi',
    mercredi:'jeudi',
    jeudi:'vendredi',
    vendredi:'samedi',
    samedi:'dimanche',
    dimanche:'lundi'
  };

  let executionEnCours=null;

  function normaliser(texte=''){
    return String(texte).trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ');
  }

  function frequenceLendemain(sortie){
    const frequence=sortie.frequence||'toutes';
    if(sortie.jour!=='dimanche')return frequence;
    if(frequence==='paire')return 'impaire';
    if(frequence==='impaire')return 'paire';
    return frequence;
  }

  function memeChantier(sortie,rentree){
    if(sortie.chantierGroupeId&&rentree.chantierGroupeId){
      return sortie.chantierGroupeId===rentree.chantierGroupeId;
    }
    return normaliser(sortie.chantierNom)===normaliser(rentree.chantierNom)
      && normaliser(sortie.adresse)===normaliser(rentree.adresse);
  }

  function rentreeExiste(sortie,plannings){
    const jour=joursSuivants[sortie.jour];
    const frequence=frequenceLendemain(sortie);

    return plannings.some(p=>{
      if(p.id===sortie.id||p.action!=='rentree'||p.actif===false)return false;
      if(p.sourceSortieId===sortie.id)return true;
      return memeChantier(sortie,p)
        && normaliser(p.typeConteneur)===normaliser(sortie.typeConteneur)
        && p.jour===jour
        && (p.frequence||'toutes')===frequence;
    });
  }

  function creerZoneEtat(){
    let zone=document.getElementById('rattrapageRentreesEtat');
    if(zone)return zone;

    zone=document.createElement('div');
    zone.id='rattrapageRentreesEtat';
    zone.style.marginTop='10px';
    zone.style.padding='10px 12px';
    zone.style.borderRadius='12px';
    zone.style.background='#eff6ff';
    zone.style.color='#1d4ed8';
    zone.style.fontSize='13px';
    zone.style.fontWeight='700';
    zone.textContent='Analyse des anciennes sorties pour créer les rentrées manquantes…';

    const formulaire=document.getElementById('enregistrerBtn')?.closest('section.card');
    if(formulaire)formulaire.appendChild(zone);
    return zone;
  }

  function afficherEtat(texte,type='info'){
    const zone=creerZoneEtat();
    const styles={
      info:['#eff6ff','#1d4ed8'],
      success:['#ecfdf5','#047857'],
      error:['#fef2f2','#b91c1c']
    };
    const [fond,couleur]=styles[type]||styles.info;
    zone.style.background=fond;
    zone.style.color=couleur;
    zone.textContent=texte;
  }

  async function enregistrerParLots(documents){
    for(let debut=0;debut<documents.length;debut+=400){
      const batch=db.batch();
      documents.slice(debut,debut+400).forEach(({id,data})=>{
        batch.set(db.collection('conteneurs_plannings').doc(id),data,{merge:false});
      });
      await batch.commit();
    }
  }

  async function executerRattrapage(){
    if(executionEnCours)return executionEnCours;

    executionEnCours=(async()=>{
      afficherEtat('Analyse des anciennes sorties pour créer les rentrées manquantes…','info');

      try{
        const snap=await db.collection('conteneurs_plannings').get();
        const plannings=[];
        snap.forEach(d=>plannings.push({id:d.id,...d.data()}));

        const sorties=plannings.filter(p=>p.action==='sortie'&&p.actif!==false&&joursSuivants[p.jour]);
        const manquantes=sorties.filter(sortie=>!rentreeExiste(sortie,plannings));

        if(!manquantes.length){
          afficherEtat(`✅ Vérification terminée : les ${sorties.length} sortie${sorties.length>1?'s':''} existante${sorties.length>1?'s':''} possèdent déjà leur rentrée.`,'success');
          return;
        }

        const maintenant=new Date().toISOString();
        const documents=manquantes.map(sortie=>({
          id:`rentree-auto-${sortie.id}`,
          data:{
            chantierNom:sortie.chantierNom||'',
            chantierGroupeId:sortie.chantierGroupeId||'',
            adresse:sortie.adresse||'',
            agentNom:sortie.agentNom||sortie.agentId||'',
            agentId:sortie.agentId||'',
            action:'rentree',
            typeConteneur:sortie.typeConteneur||'OM',
            jour:joursSuivants[sortie.jour],
            heureDebut:'08:00',
            heureFin:'12:00',
            frequence:frequenceLendemain(sortie),
            actif:true,
            sourceSortieId:sortie.id,
            sourceSortieJour:sortie.jour,
            sourceSortieFrequence:sortie.frequence||'toutes',
            rentreeAutomatique:true,
            rattrapageSortieExistante:true,
            rattrapageLe:maintenant,
            ...(Array.isArray(sortie.remplacements)?{remplacements:sortie.remplacements}:{}),
            createdAt:firebase.firestore.FieldValue.serverTimestamp()
          }
        }));

        await enregistrerParLots(documents);
        afficherEtat(`✅ ${documents.length} rentrée${documents.length>1?'s':''} manquante${documents.length>1?'s':''} créée${documents.length>1?'s':''} automatiquement à partir des sorties déjà enregistrées.`,'success');

        if(typeof charger==='function')await charger();
      }catch(e){
        console.error(e);
        afficherEtat(`Rattrapage impossible : ${e.message}`,'error');
      }
    })().finally(()=>{executionEnCours=null;});

    return executionEnCours;
  }

  window.executerRattrapageRentrees=executerRattrapage;

  if(window.auth?.currentUser){
    setTimeout(executerRattrapage,0);
  }else{
    window.auth?.onAuthStateChanged(user=>{if(user)executerRattrapage();});
  }
})();
