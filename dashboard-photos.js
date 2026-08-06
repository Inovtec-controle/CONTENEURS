(function(){
  if(window.dashboardPhotosChargees)return;
  window.dashboardPhotosChargees=true;

  const style=document.createElement('style');
  style.textContent=`
    .photo-dashboard-btn{margin-top:7px;padding:6px 9px;border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:800;cursor:pointer}
    .photo-absente{display:block;margin-top:6px;color:#94a3b8;font-size:11px}
    .photo-viewer-backdrop{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.78)}
    .photo-viewer-backdrop.open{display:flex}
    .photo-viewer{width:min(95vw,760px);max-height:94vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(15,23,42,.4)}
    .photo-viewer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .photo-viewer h2{margin:0;font-size:20px}
    .photo-viewer-close{border:0;background:#f1f5f9;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer}
    .photo-viewer-meta{margin:7px 0 12px;color:#64748b;font-size:13px;line-height:1.5}
    .photo-viewer-img{display:none;width:100%;max-height:70vh;object-fit:contain;border-radius:14px;background:#f1f5f9}
    .photo-viewer-img.visible{display:block}
    .photo-viewer-state{padding:24px;text-align:center;color:#475569;font-weight:700}
  `;
  document.head.appendChild(style);

  const backdrop=document.createElement('div');
  backdrop.className='photo-viewer-backdrop';
  backdrop.innerHTML=`
    <div class="photo-viewer" role="dialog" aria-modal="true" aria-labelledby="photoViewerTitle">
      <div class="photo-viewer-head">
        <h2 id="photoViewerTitle">📷 Preuve photo</h2>
        <button class="photo-viewer-close" type="button">Fermer</button>
      </div>
      <div id="photoViewerMeta" class="photo-viewer-meta"></div>
      <div id="photoViewerState" class="photo-viewer-state">Chargement…</div>
      <img id="photoViewerImg" class="photo-viewer-img" alt="Photo du passage">
    </div>`;
  document.body.appendChild(backdrop);

  const fermerBtn=backdrop.querySelector('.photo-viewer-close');
  const meta=backdrop.querySelector('#photoViewerMeta');
  const etat=backdrop.querySelector('#photoViewerState');
  const image=backdrop.querySelector('#photoViewerImg');
  const contextePhotos=new Map();

  function fermer(){
    backdrop.classList.remove('open');
    image.src='';
    image.classList.remove('visible');
    etat.style.display='block';
    etat.textContent='Chargement…';
  }
  fermerBtn.addEventListener('click',fermer);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)fermer();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.classList.contains('open'))fermer();});

  async function voirPhoto(pointageId){
    const contexte=contextePhotos.get(pointageId)||{};
    backdrop.classList.add('open');
    meta.textContent=[contexte.chantierNom,contexte.action,contexte.agentNom,contexte.dateHeure].filter(Boolean).join(' · ');
    etat.style.display='block';
    etat.textContent='Chargement de la photo…';
    image.classList.remove('visible');

    try{
      const snap=await db.collection('conteneurs_pointages').doc(pointageId).collection('photos').doc('preuve').get();
      if(!snap.exists||!snap.data()?.dataUrl){
        etat.textContent='Aucune photo enregistrée pour ce passage.';
        return;
      }
      image.onload=()=>{
        etat.style.display='none';
        image.classList.add('visible');
      };
      image.onerror=()=>{etat.textContent='La photo ne peut pas être affichée.';};
      image.src=snap.data().dataUrl;
    }catch(e){
      etat.textContent=`Chargement impossible : ${e.message}`;
    }
  }

  window.voirPhotoPointage=voirPhoto;

  charger=async function(){
    const isoSelection=dateInput.value||dateISO();
    const dateSelection=dateDepuisISO(isoSelection);
    afficherDate(dateSelection);
    rows.innerHTML='<tr><td colspan="7" class="empty">Chargement…</td></tr>';

    const [ps,pts]=await Promise.all([
      db.collection('conteneurs_plannings').get(),
      db.collection('conteneurs_pointages').where('date','==',isoSelection).get()
    ]);
    const points={};
    pts.forEach(d=>points[d.id]={id:d.id,...d.data()});
    const plans=[];
    ps.forEach(d=>{const p={id:d.id,...d.data()};if(planningValablePourDate(p,dateSelection))plans.push(p);});
    plans.sort((a,b)=>(a.heureDebut||'').localeCompare(b.heureDebut||'')||(a.chantierNom||'').localeCompare(b.chantierNom||'','fr'));

    contextePhotos.clear();
    let fait=0,probleme=0,nonEffectue=0,aFaire=0,aVenir=0;
    rows.innerHTML=plans.map(p=>{
      const pointageId=idPointage(p.id,dateSelection);
      const point=points[pointageId];
      const effectif=agentEffectifPourDate(p,dateSelection);
      let badge='',heure='—',ligneClasse='';
      if(point?.statut==='fait'){fait++;badge='<span class="badge done-badge">Fait</span>';heure=point.heure||'—';}
      else if(point?.statut==='probleme'){probleme++;ligneClasse='row-problem';badge='<span class="badge problem-badge">Problème</span>';heure=point.heure||'—';}
      else if(estDatePassee(isoSelection)){nonEffectue++;ligneClasse='row-missed';badge='<span class="badge missed-badge">Non effectué</span>';}
      else if(estAujourdhui(isoSelection)){aFaire++;badge='<span class="badge todo">À faire</span>';}
      else{aVenir++;badge='<span class="badge future-badge">À venir</span>';}

      const nomAgent=point?.agentNom||effectif.agentNom||effectif.agentId;
      const agentHTML=effectif.estRemplacant
        ? `<strong>${echapper(nomAgent)}</strong><br><span class="replacement-badge">Remplace ${echapper(effectif.titulaireNom||effectif.titulaireId)}</span>`
        : echapper(nomAgent);

      let photoHTML='';
      if(point?.photoPresente){
        contextePhotos.set(pointageId,{
          chantierNom:p.chantierNom||'',
          action:p.action==='sortie'?'Sortie':'Rentrée',
          agentNom:nomAgent||'',
          dateHeure:`${isoSelection}${point.heure?' à '+point.heure:''}`
        });
        photoHTML=`<br><button class="photo-dashboard-btn" type="button" data-pointage-id="${echapper(pointageId)}">📷 Voir la photo</button>`;
      }else if(point){
        photoHTML='<span class="photo-absente">Aucune photo</span>';
      }

      return `<tr class="${ligneClasse}">
        <td><strong>${echapper(p.chantierNom)}</strong><br><span class="meta">${echapper(p.adresse||'')}</span></td>
        <td>${p.action==='sortie'?'Sortie':'Rentrée'}</td>
        <td><span class="type-tag">${echapper(p.typeConteneur||'Non précisé')}</span></td>
        <td>${agentHTML}</td>
        <td>${echapper(p.heureDebut||'—')}–${echapper(p.heureFin||'—')}</td>
        <td>${badge}${point?.motif?`<br><span class="meta">${echapper(point.motif)}</span>`:''}${photoHTML}</td>
        <td>${echapper(heure)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">Aucune intervention prévue pour cette date.</td></tr>';

    document.querySelectorAll('.photo-dashboard-btn').forEach(b=>b.addEventListener('click',()=>voirPhoto(b.dataset.pointageId)));

    const defaillances=probleme+nonEffectue;
    stats.innerHTML=`
      <div class="stat"><span>Prévus</span><strong>${plans.length}</strong></div>
      <div class="stat"><span>Effectués</span><strong>${fait}</strong></div>
      <div class="stat"><span>${estDatePassee(isoSelection)?'Non effectués':estAujourdhui(isoSelection)?'À faire':'À venir'}</span><strong>${estDatePassee(isoSelection)?nonEffectue:estAujourdhui(isoSelection)?aFaire:aVenir}</strong></div>
      <div class="stat"><span>Problèmes</span><strong>${probleme}</strong></div>
      <div class="stat failure"><span>Défaillances</span><strong>${defaillances}</strong></div>`;
  };

  setTimeout(()=>{if(window.auth?.currentUser)charger().catch(afficherErreur);},0);
})();
