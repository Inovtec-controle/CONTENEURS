(function(){
  if(window.rentreeAutoSortieChargee)return;
  window.rentreeAutoSortieChargee=true;

  const bouton=document.getElementById('enregistrerBtn');
  if(!bouton)return;

  const joursSuivants={
    lundi:'mardi',
    mardi:'mercredi',
    mercredi:'jeudi',
    jeudi:'vendredi',
    vendredi:'samedi',
    samedi:'dimanche',
    dimanche:'lundi'
  };

  const horairesDefaut={
    sortie:{debut:'15:00',fin:'19:30'},
    rentree:{debut:'08:00',fin:'12:00'}
  };

  const note=document.createElement('div');
  note.style.marginTop='10px';
  note.style.padding='10px 12px';
  note.style.borderRadius='12px';
  note.style.background='#ecfdf5';
  note.style.color='#047857';
  note.style.fontSize='13px';
  note.style.fontWeight='700';
  note.textContent='↩️ Horaires proposés automatiquement : sorties de 15h00 à 19h30 et rentrées de 08h00 à 12h00. Tous les horaires restent modifiables.';
  bouton.closest('.form-actions')?.after(note);

  function installerHorairesSurLigne(ligne){
    if(!ligne)return;
    const action=ligne.querySelector('.passage-action');
    const debut=ligne.querySelector('.passage-debut');
    const fin=ligne.querySelector('.passage-fin');
    if(!action||!debut||!fin)return;

    const plage=horairesDefaut[action.value]||horairesDefaut.sortie;
    if(!debut.value&&!fin.value){
      debut.value=plage.debut;
      fin.value=plage.fin;
    }
    ligne.dataset.horaireAction=action.value;

    if(ligne.dataset.horairesDefautInstalles==='oui')return;
    ligne.dataset.horairesDefautInstalles='oui';

    action.addEventListener('change',()=>{
      const ancienneAction=ligne.dataset.horaireAction||'sortie';
      const anciennePlage=horairesDefaut[ancienneAction]||horairesDefaut.sortie;
      const nouvellePlage=horairesDefaut[action.value]||horairesDefaut.sortie;
      const horairesEncoreAutomatiques=
        (!debut.value&&!fin.value)
        ||(debut.value===anciennePlage.debut&&fin.value===anciennePlage.fin);

      if(horairesEncoreAutomatiques){
        debut.value=nouvellePlage.debut;
        fin.value=nouvellePlage.fin;
      }
      ligne.dataset.horaireAction=action.value;
    });
  }

  const ajouterLignePassageBase=ajouterLignePassage;
  ajouterLignePassage=function(valeurs={}){
    const valeursCompletees={...valeurs};
    const action=valeursCompletees.action||'sortie';
    const plage=horairesDefaut[action]||horairesDefaut.sortie;

    if(valeursCompletees.heureDebut===undefined&&valeursCompletees.heureFin===undefined){
      valeursCompletees.heureDebut=plage.debut;
      valeursCompletees.heureFin=plage.fin;
    }

    ajouterLignePassageBase(valeursCompletees);
    installerHorairesSurLigne(passagesZone.lastElementChild);
  };

  passagesZone.querySelectorAll('.passage-row').forEach(installerHorairesSurLigne);

  function frequenceDuLendemain(passage){
    const frequence=passage.frequence||'toutes';
    if(passage.jour!=='dimanche')return frequence;
    if(frequence==='paire')return 'impaire';
    if(frequence==='impaire')return 'paire';
    return frequence;
  }

  function correspondARentreeManuelle(sortie,rentree){
    return rentree.action==='rentree'
      && rentree.jour===joursSuivants[sortie.jour]
      && rentree.typeConteneur===sortie.typeConteneur
      && (rentree.frequence||'toutes')===frequenceDuLendemain(sortie);
  }

  function verifierPassages(passages){
    const doublons=new Set();
    for(const passage of passages){
      if(!passage.jour||!passage.action||!['OM','TRI','OM/TRI'].includes(passage.typeConteneur)){
        return 'Chaque ligne doit contenir un jour, une action et un type OM, TRI ou OM/TRI.';
      }
      if(!['sortie','rentree'].includes(passage.action)){
        return 'Une action de passage est incorrecte.';
      }
      if(!['toutes','paire','impaire'].includes(passage.frequence)){
        return 'Une fréquence de passage est incorrecte.';
      }
      if(passage.heureDebut&&passage.heureFin&&passage.heureFin<=passage.heureDebut){
        return `L’heure de fin doit être après l’heure de début pour le passage du ${passage.jour}.`;
      }
      const cle=[passage.jour,passage.action,passage.typeConteneur,passage.heureDebut,passage.heureFin,passage.frequence].join('|');
      if(doublons.has(cle))return 'Deux lignes de passage sont identiques. Supprime le doublon avant d’enregistrer.';
      doublons.add(cle);
    }
    return '';
  }

  function donneesCommunes({chantier,chantierGroupeId,adresse,agentNom,agentId,passage}){
    return {
      chantierNom:chantier,
      chantierGroupeId,
      adresse,
      agentNom:agentNom||agentId,
      agentId,
      action:passage.action,
      typeConteneur:passage.typeConteneur,
      jour:passage.jour,
      heureDebut:passage.heureDebut,
      heureFin:passage.heureFin,
      frequence:passage.frequence,
      actif:true,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function enregistrerAvecRentrees(event){
    event.preventDefault();
    event.stopImmediatePropagation();

    const chantier=document.getElementById('chantier').value.trim();
    const adresse=document.getElementById('adresse').value.trim();
    const agentNom=document.getElementById('agentNom').value.trim();
    const agentId=nettoyerIdentifiant(document.getElementById('agentId').value);
    const passages=lirePassages();

    if(!chantier||!agentId){
      afficherMessage('Le nom du chantier et l’identifiant de l’agent sont obligatoires.','error');
      return;
    }
    if(!passages.length){
      afficherMessage('Ajoute au moins un passage.','error');
      return;
    }

    const erreur=verifierPassages(passages);
    if(erreur){
      afficherMessage(erreur,'error');
      return;
    }

    bouton.disabled=true;
    bouton.textContent='Enregistrement des passages et des rentrées…';
    afficherMessage('Création du planning et des rentrées automatiques…','info');

    try{
      const batch=db.batch();
      const chantierGroupeId=`${nettoyerIdentifiant(chantier)}-${Date.now()}`;
      let rentreesCreees=0;

      passages.forEach(passage=>{
        const passageRef=db.collection('conteneurs_plannings').doc();
        batch.set(passageRef,donneesCommunes({
          chantier,chantierGroupeId,adresse,agentNom,agentId,passage
        }));

        if(passage.action!=='sortie')return;

        const rentreeDejaSaisie=passages.some(autre=>autre!==passage&&correspondARentreeManuelle(passage,autre));
        if(rentreeDejaSaisie)return;

        const rentreeRef=db.collection('conteneurs_plannings').doc();
        const rentree={
          jour:joursSuivants[passage.jour],
          action:'rentree',
          typeConteneur:passage.typeConteneur,
          heureDebut:horairesDefaut.rentree.debut,
          heureFin:horairesDefaut.rentree.fin,
          frequence:frequenceDuLendemain(passage)
        };

        batch.set(rentreeRef,{
          ...donneesCommunes({chantier,chantierGroupeId,adresse,agentNom,agentId,passage:rentree}),
          rentreeAutomatique:true,
          sourceSortieId:passageRef.id,
          sourceSortieJour:passage.jour,
          sourceSortieFrequence:passage.frequence
        });
        rentreesCreees++;
      });

      await batch.commit();
      const total=passages.length+rentreesCreees;
      reinitialiserFormulaire();
      afficherMessage(`✅ ${total} passage${total>1?'s':''} enregistré${total>1?'s':''}, dont ${rentreesCreees} rentrée${rentreesCreees>1?'s':''} automatique${rentreesCreees>1?'s':''}.`,'success');
      await charger();
    }catch(e){
      console.error(e);
      const aide=e.code==='permission-denied'
        ? ' Accès refusé par Firebase : vérifie les règles Firestore et ta connexion.'
        : '';
      afficherMessage(`Impossible d’enregistrer : ${e.message}.${aide}`,'error');
    }finally{
      bouton.disabled=false;
      bouton.textContent='✅ Enregistrer le chantier et tous ses passages';
    }
  }

  bouton.addEventListener('click',enregistrerAvecRentrees,true);
})();
