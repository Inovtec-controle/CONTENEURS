(function(){
  const style=document.createElement('style');
  style.textContent='.replacement-badge{display:inline-block;margin-top:4px;padding:3px 7px;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:700}';
  document.head.appendChild(style);

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
    pts.forEach(d=>points[d.id]=d.data());
    const plans=[];
    ps.forEach(d=>{const p={id:d.id,...d.data()};if(planningValablePourDate(p,dateSelection))plans.push(p);});
    plans.sort((a,b)=>(a.heureDebut||'').localeCompare(b.heureDebut||'')||(a.chantierNom||'').localeCompare(b.chantierNom||'','fr'));

    let fait=0,probleme=0,nonEffectue=0,aFaire=0,aVenir=0;
    rows.innerHTML=plans.map(p=>{
      const point=points[idPointage(p.id,dateSelection)];
      const effectif=agentEffectifPourDate(p,dateSelection);
      let badge='',heure='—',ligneClasse='';
      if(point?.statut==='fait'){fait++;badge='<span class="badge done-badge">Fait</span>';heure=point.heure||'—';}
      else if(point?.statut==='probleme'){probleme++;ligneClasse='row-problem';badge='<span class="badge problem-badge">Problème</span>';heure=point.heure||'—';}
      else if(estDatePassee(isoSelection)){nonEffectue++;ligneClasse='row-missed';badge='<span class="badge missed-badge">Non effectué</span>';}
      else if(estAujourdhui(isoSelection)){aFaire++;badge='<span class="badge todo">À faire</span>';}
      else{aVenir++;badge='<span class="badge future-badge">À venir</span>';}
      const agentHTML=effectif.estRemplacant
        ? `<strong>${echapper(effectif.agentNom)}</strong><br><span class="replacement-badge">Remplace ${echapper(effectif.titulaireNom||effectif.titulaireId)}</span>`
        : echapper(effectif.agentNom||effectif.agentId);
      return `<tr class="${ligneClasse}">
        <td><strong>${echapper(p.chantierNom)}</strong><br><span class="meta">${echapper(p.adresse||'')}</span></td>
        <td>${p.action==='sortie'?'Sortie':'Rentrée'}</td>
        <td><span class="type-tag">${echapper(p.typeConteneur||'Non précisé')}</span></td>
        <td>${agentHTML}</td>
        <td>${echapper(p.heureDebut||'—')}–${echapper(p.heureFin||'—')}</td>
        <td>${badge}${point?.motif?`<br><span class="meta">${echapper(point.motif)}</span>`:''}</td>
        <td>${echapper(heure)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">Aucune intervention prévue pour cette date.</td></tr>';

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
