(function(){
  if(window.photosPointagesAgentChargees)return;
  window.photosPointagesAgentChargees=true;

  const style=document.createElement('style');
  style.textContent=`
    .photo-proof-note{margin-top:8px;color:#475569;font-size:12px;font-weight:700}
    .photo-modal-backdrop{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.72)}
    .photo-modal-backdrop.open{display:flex}
    .photo-modal{width:min(94vw,520px);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(15,23,42,.35)}
    .photo-modal h2{margin:0 0 6px;font-size:21px}
    .photo-modal p{margin:0 0 14px;color:#64748b;font-size:13px}
    .photo-preview{display:none;width:100%;max-height:48vh;object-fit:contain;border-radius:14px;background:#f1f5f9;margin:12px 0}
    .photo-preview.visible{display:block}
    .photo-modal-actions{display:grid;gap:9px;margin-top:12px}
    .photo-modal-actions button{width:100%;padding:12px}
    .photo-file-input{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
    .photo-error{display:none;margin-top:10px;padding:9px 11px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:12px;font-weight:700}
    .photo-error.visible{display:block}
    .photo-size{margin-top:6px;color:#64748b;font-size:11px;text-align:center}
  `;
  document.head.appendChild(style);

  const backdrop=document.createElement('div');
  backdrop.className='photo-modal-backdrop';
  backdrop.innerHTML=`
    <div class="photo-modal" role="dialog" aria-modal="true" aria-labelledby="photoModalTitre">
      <h2 id="photoModalTitre">📷 Photo du passage</h2>
      <p id="photoModalTexte"></p>
      <input id="photoFileInput" class="photo-file-input" type="file" accept="image/*" capture="environment">
      <button id="photoChoisirBtn" class="ok" type="button">📷 Prendre une photo</button>
      <img id="photoPreview" class="photo-preview" alt="Aperçu de la photo">
      <div id="photoSize" class="photo-size"></div>
      <div id="photoError" class="photo-error"></div>
      <div class="photo-modal-actions">
        <button id="photoValiderBtn" class="ok" type="button">Valider avec la photo</button>
        <button id="photoSansBtn" class="btn secondary" type="button">Continuer sans photo</button>
        <button id="photoAnnulerBtn" class="btn secondary" type="button">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const input=backdrop.querySelector('#photoFileInput');
  const choisirBtn=backdrop.querySelector('#photoChoisirBtn');
  const validerBtn=backdrop.querySelector('#photoValiderBtn');
  const sansBtn=backdrop.querySelector('#photoSansBtn');
  const annulerBtn=backdrop.querySelector('#photoAnnulerBtn');
  const preview=backdrop.querySelector('#photoPreview');
  const taille=backdrop.querySelector('#photoSize');
  const erreur=backdrop.querySelector('#photoError');
  const titre=backdrop.querySelector('#photoModalTitre');
  const texte=backdrop.querySelector('#photoModalTexte');

  let resolutionCapture=null;
  let photoPreparee=null;
  let obligatoire=true;
  let validationEnCours=false;

  function afficherErreurPhoto(message){
    erreur.textContent=message;
    erreur.classList.add('visible');
  }

  function fermerCapture(resultat){
    backdrop.classList.remove('open');
    input.value='';
    preview.src='';
    preview.classList.remove('visible');
    taille.textContent='';
    erreur.textContent='';
    erreur.classList.remove('visible');
    photoPreparee=null;
    if(resolutionCapture){
      const resolve=resolutionCapture;
      resolutionCapture=null;
      resolve(resultat);
    }
  }

  function ouvrirCapture({estObligatoire,statut}){
    obligatoire=estObligatoire;
    photoPreparee=null;
    titre.textContent=statut==='fait'?'📷 Photo obligatoire':'📷 Photo du problème';
    texte.textContent=statut==='fait'
      ? 'Prends une photo montrant les conteneurs après le passage. La validation ne peut pas être enregistrée sans photo.'
      : 'Tu peux ajouter une photo pour montrer le problème, ou continuer sans photo.';
    validerBtn.disabled=true;
    sansBtn.style.display=obligatoire?'none':'block';
    backdrop.classList.add('open');
    return new Promise(resolve=>{resolutionCapture=resolve;});
  }

  function lireFichierCommeImage(file){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file);
      const image=new Image();
      image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Cette image ne peut pas être lue. Essaie avec une autre photo.'));};
      image.src=url;
    });
  }

  function canvasVersBlob(canvas,qualite){
    return new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Compression de la photo impossible.')),'image/jpeg',qualite);
    });
  }

  function blobVersDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const lecteur=new FileReader();
      lecteur.onload=()=>resolve(lecteur.result);
      lecteur.onerror=()=>reject(new Error('Lecture de la photo impossible.'));
      lecteur.readAsDataURL(blob);
    });
  }

  async function compresserPhoto(file){
    const image=await lireFichierCommeImage(file);
    const maxDimension=960;
    let largeur=image.naturalWidth||image.width;
    let hauteur=image.naturalHeight||image.height;
    const ratio=Math.min(1,maxDimension/Math.max(largeur,hauteur));
    largeur=Math.max(1,Math.round(largeur*ratio));
    hauteur=Math.max(1,Math.round(hauteur*ratio));

    const canvas=document.createElement('canvas');
    const contexte=canvas.getContext('2d',{alpha:false});
    if(!contexte)throw new Error('Compression indisponible sur ce téléphone.');

    let blob=null;
    let qualite=0.78;
    for(let tentative=0;tentative<8;tentative++){
      canvas.width=largeur;
      canvas.height=hauteur;
      contexte.fillStyle='#ffffff';
      contexte.fillRect(0,0,largeur,hauteur);
      contexte.drawImage(image,0,0,largeur,hauteur);
      blob=await canvasVersBlob(canvas,qualite);
      if(blob.size<=180000)break;
      if(qualite>0.42){
        qualite-=0.09;
      }else{
        largeur=Math.max(420,Math.round(largeur*0.82));
        hauteur=Math.max(420,Math.round(hauteur*0.82));
      }
    }

    if(!blob||blob.size>300000){
      throw new Error('La photo reste trop lourde. Reprends-la en cadrant uniquement les conteneurs.');
    }

    return {
      dataUrl:await blobVersDataUrl(blob),
      mime:'image/jpeg',
      tailleOctets:blob.size,
      largeur:canvas.width,
      hauteur:canvas.height
    };
  }

  choisirBtn.addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files&&input.files[0];
    if(!file)return;
    choisirBtn.disabled=true;
    choisirBtn.textContent='Compression en cours…';
    erreur.classList.remove('visible');
    try{
      photoPreparee=await compresserPhoto(file);
      preview.src=photoPreparee.dataUrl;
      preview.classList.add('visible');
      taille.textContent=`Photo compressée : ${Math.round(photoPreparee.tailleOctets/1024)} Ko`;
      validerBtn.disabled=false;
      choisirBtn.textContent='🔄 Reprendre la photo';
    }catch(e){
      photoPreparee=null;
      validerBtn.disabled=true;
      afficherErreurPhoto(e.message);
      choisirBtn.textContent='📷 Reprendre une photo';
    }finally{
      choisirBtn.disabled=false;
    }
  });
  validerBtn.addEventListener('click',()=>{if(photoPreparee)fermerCapture({photo:photoPreparee});});
  sansBtn.addEventListener('click',()=>fermerCapture({photo:null}));
  annulerBtn.addEventListener('click',()=>fermerCapture({annule:true}));
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)fermerCapture({annule:true});});

  window.valider=async function(id,statut,bouton){
    if(validationEnCours)return;
    validationEnCours=true;

    let motif='';
    if(statut==='probleme'){
      const saisie=prompt('Quel est le problème ?');
      if(saisie===null){validationEnCours=false;return;}
      motif=saisie.trim()||'Problème non précisé';
    }

    const boutons=[...document.querySelectorAll(`#tile-${id} button`)];
    boutons.forEach(b=>b.disabled=true);

    try{
      const choix=await ouvrirCapture({estObligatoire:statut==='fait',statut});
      if(choix?.annule){
        boutons.forEach(b=>b.disabled=false);
        return;
      }
      if(statut==='fait'&&!choix?.photo){
        boutons.forEach(b=>b.disabled=false);
        alert('Une photo est obligatoire pour valider ce passage comme effectué.');
        return;
      }

      const ancienTexte=bouton.textContent;
      bouton.textContent='Enregistrement…';
      const now=new Date();
      const planning=plansAffiches.get(id);
      const effectif=planning?.effectif||agentEffectifPourDate(planning||{},now);
      const pointageId=idPointage(id,now);
      const pointageRef=db.collection('conteneurs_pointages').doc(pointageId);
      const batch=db.batch();

      batch.set(pointageRef,{
        planningId:id,
        agentId:effectif.agentId||agent,
        agentNom:effectif.agentNom||agent,
        titulaireAgentId:effectif.titulaireId||planning?.agentId||'',
        titulaireAgentNom:effectif.titulaireNom||planning?.agentNom||'',
        remplacementId:effectif.remplacementId||'',
        date:dateISO(now),
        heure:now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        statut,
        motif,
        photoPresente:Boolean(choix?.photo),
        photoObligatoire:statut==='fait',
        photoVersion:1,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });

      if(choix?.photo){
        batch.set(pointageRef.collection('photos').doc('preuve'),{
          ...choix.photo,
          planningId:id,
          pointageId,
          chantierNom:planning?.chantierNom||'',
          action:planning?.action||'',
          typeConteneur:planning?.typeConteneur||'',
          agentId:effectif.agentId||agent,
          agentNom:effectif.agentNom||agent,
          statut,
          date:dateISO(now),
          heure:now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
          createdAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      await batch.commit();
      await charger();
      bouton.textContent=ancienTexte;
    }catch(e){
      boutons.forEach(b=>b.disabled=false);
      alert(`Impossible d’enregistrer : ${e.message}`);
    }finally{
      validationEnCours=false;
    }
  };

  window.corrigerSaisie=async function(id,bouton){
    const confirmation=confirm('Annuler cette saisie et supprimer sa photo pour pouvoir la refaire ?');
    if(!confirmation)return;

    bouton.disabled=true;
    const ancienTexte=bouton.textContent;
    bouton.textContent='Annulation…';
    const pointageRef=db.collection('conteneurs_pointages').doc(idPointage(id));

    try{
      const batch=db.batch();
      batch.delete(pointageRef.collection('photos').doc('preuve'));
      batch.delete(pointageRef);
      await batch.commit();
      await charger();
    }catch(e){
      bouton.disabled=false;
      bouton.textContent=ancienTexte;
      alert(`Impossible de corriger la saisie : ${e.message}`);
    }
  };
})();
