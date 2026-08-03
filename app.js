(() => {
  'use strict';
  const DATA = window.MARS_ACADEMY_CONTENT;
  const STORAGE_KEY = 'marsCombatAcademyV2State';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let view = 'home';
  let practiceFilter = 'All';
  let practiceQueue = [];
  let practiceIndex = 0;
  let practiceAnswered = false;
  let storageAvailable = true;
  let state = loadState();
  let reflex = {running:false,start:0,duration:1200,raf:null};

  function initialState(){
    return {
      version:2,
      completedLessons:[],
      completedPractice:[],
      completedMissions:[],
      bookmarks:[],
      recentLesson:null,
      notes:[],
      scratchpad:'',
      labDesigns:{},
      srs:{},
      preferences:{practiceCategory:'All'}
    };
  }
  function loadState(){
    try { return {...initialState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))}; }
    catch(e){ storageAvailable=false; console.warn(e); return initialState(); }
  }
  function save(message){
    if(storageAvailable){
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch(e){ storageAvailable=false; console.warn(e); }
    }
    if(message) toast(message);
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  // ---------------- spaced repetition (Leitner) ----------------
  const GODOT_TARGET='4.4+';
  const DAY=86400000;
  const SRS_STEPS=[0,1,3,7,16,35];   // days to next review, indexed by box-1
  const SESSION_SIZE=10;
  let session={correct:0,wrong:0,answered:0};
  function srsFor(id){return state.srs[id]||{box:1,due:0,last:0,seen:0,correct:0,wrong:0};}
  function srsDueIn(id){const r=state.srs[id]; return r?r.due-Date.now():-1;}
  function srsRecord(id,correct){
    const r=srsFor(id);
    r.seen++;
    if(correct){r.correct++;r.box=Math.min(SRS_STEPS.length,r.box+1);}
    else{r.wrong++;r.box=1;}
    r.last=Date.now();
    r.due=r.last+SRS_STEPS[r.box-1]*DAY;
    state.srs[id]=r;
  }
  function dueItems(pool=DATA.practice){return pool.filter(q=>state.srs[q.id]&&srsDueIn(q.id)<=0);}
  function unseenItems(pool=DATA.practice){return pool.filter(q=>!state.srs[q.id]);}
  function srsLabel(id){
    const r=state.srs[id];
    if(!r)return 'New';
    const ms=r.due-Date.now();
    if(ms<=0)return 'Box '+r.box+' · due now';
    const d=Math.max(1,Math.round(ms/DAY));
    return 'Box '+r.box+' · '+(d===1?'1 day':d+' days');
  }
  function srsStats(){
    const ids=Object.keys(state.srs);
    return {tracked:ids.length,due:dueItems().length,unseen:unseenItems().length,
            mature:ids.filter(i=>state.srs[i].box>=4).length,total:DATA.practice.length};
  }
  function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function currentQ(){return practiceQueue[practiceIndex]||null;}
  function toast(text){const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2000);}
  function copyText(text){
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(()=>toast('Copied')).catch(()=>fallbackCopy(text));
    else fallbackCopy(text);
  }
  function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied');}
  function openDrawer(){ $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden','false'); $('#scrim').hidden=false; }
  function closeDrawer(){ $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden','true'); $('#scrim').hidden=true; }
  function openModal(title,html){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modalBackdrop').hidden=false;document.body.style.overflow='hidden';}
  function closeModal(){if(reflex.raf)cancelAnimationFrame(reflex.raf);reflex.running=false;$('#modalBackdrop').hidden=true;document.body.style.overflow='';}
  function showView(name){
    view=name;
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    const subtitles={home:'Portable training lab',learn:'Guided lessons',practice:'Active recall and debugging',build:'Xogot and design missions',labs:'Interactive system design',reference:'Searchable handbook',notes:'Your development workshop',settings:'Local data and backup'};
    $('#headerSubtitle').textContent=subtitles[name]||'Mars Combat Academy';
    closeDrawer(); window.scrollTo({top:0,behavior:'instant'}); renderView(name);
  }
  function renderView(name){
    ({home:renderHome,learn:renderLearn,practice:renderPractice,build:renderBuild,labs:renderLabs,reference:renderReference,notes:renderNotes,settings:renderSettings}[name]||renderHome)();
  }
  function findLesson(id){for(const m of DATA.modules){const l=m.lessons.find(x=>x.id===id);if(l)return {module:m,lesson:l};}return null;}
  function allLessons(){return DATA.modules.flatMap(m=>m.lessons.map(l=>({...l,moduleTitle:m.title,moduleId:m.id})));}
  function lessonDone(id){return state.completedLessons.includes(id);}
  function missionDone(id){return state.completedMissions.includes(id);}
  function toggleInArray(arr,id){const i=arr.indexOf(id); if(i>=0)arr.splice(i,1);else arr.push(id);}
  function randomItem(arr){return arr[Math.floor(Math.random()*arr.length)];}

  function renderHome(){
    const recent=state.recentLesson?findLesson(state.recentLesson):null;
    const next=recent?.lesson || allLessons().find(l=>!lessonDone(l.id)) || allLessons()[0];
    const nextMission=DATA.missions.find(m=>!missionDone(m.id))||DATA.missions[0];
    const stats=srsStats();
    const suggestion=dueItems()[0]||unseenItems()[0]||DATA.practice[0];
    $('#view-home').innerHTML=`
      <div class="hero">
        <div class="eyebrow">Portable training lab</div>
        <h1>Learn something. Solve something. Design something.</h1>
        <p>The main screen no longer asks for hours or streaks. Choose a useful activity based on the device and attention you have right now.</p>
        <div class="hero-actions">
          <button class="primary" data-open-lesson="${esc(next.id)}">${recent?'Continue lesson':'Start learning'}</button>
          <button class="secondary" data-quick-practice="${esc(suggestion.id)}">${stats.due?`Review ${stats.due} due`:'Practice session'}</button>
        </div>
      </div>
      <div class="section-title"><h2>Choose your mode</h2><p>Each produces usable knowledge or project work</p></div>
      <div class="grid two">
        <article class="card quick-card interactive" data-go="learn"><div class="icon">▤</div><h2>Learn</h2><p>Guided Godot, GDScript, 3D math, animation, combat, AI, Blender, and debugging lessons.</p><button class="secondary">Open lessons</button></article>
        <article class="card quick-card interactive" data-go="practice"><div class="icon">◎</div><h2>Practice</h2><p>Predict output, fill code, find bugs, order systems, and answer applied design questions.</p><button class="secondary">Start a drill</button></article>
        <article class="card quick-card interactive" data-go="build"><div class="icon">⌘</div><h2>Build</h2><p>Phone-sized Xogot missions and design work that transfers directly into the vertical slice.</p><button class="secondary">Open missions</button></article>
        <article class="card quick-card interactive" data-go="labs"><div class="icon">⌁</div><h2>Labs</h2><p>Design attacks, test defense timing, visualize vectors, configure collision, and plan AI.</p><button class="secondary">Open labs</button></article>
      </div>
      <div class="section-title"><h2>Useful next actions</h2></div>
      <div class="grid desktop-two">
        <article class="card"><span class="badge">Lesson</span><h2>${esc(next.title)}</h2><p>${esc(next.summary)}</p><div class="button-row" style="margin-top:12px"><button class="primary" data-open-lesson="${esc(next.id)}">Open</button></div></article>
        <article class="card"><span class="badge">${esc(nextMission.device)}</span><h2>${esc(nextMission.title)}</h2><p>${esc(nextMission.objective)}</p><div class="button-row" style="margin-top:12px"><button class="primary" data-open-mission="${esc(nextMission.id)}">Open mission</button></div></article>
      </div>
      <div class="section-title"><h2>Interactive tools</h2></div>
      <div class="filter-row">${DATA.labs.map(l=>`<button class="chip" data-open-lab="${l.id}">${esc(l.title)}</button>`).join('')}</div>`;
  }

  function renderLearn(){
    $('#view-learn').innerHTML=`<div class="page-head"><div class="eyebrow">Guided curriculum</div><h1>Learn the system, not just the vocabulary</h1><p>Forty focused lessons explain the concepts needed for the duel slice. Each ends with a practical exercise and a check for understanding.</p></div>
      <div class="grid desktop-two">${DATA.modules.map((m,i)=>{
        const done=m.lessons.filter(l=>lessonDone(l.id)).length;
        return `<article class="card module-card"><div class="module-number">${i+1}</div><div class="content"><h2>${esc(m.title)}</h2><p>${esc(m.subtitle)}</p><div class="count">${done} of ${m.lessons.length} lessons marked understood</div><div class="lesson-list">${m.lessons.map(l=>`<button class="lesson-row ${lessonDone(l.id)?'done':''}" data-open-lesson="${l.id}"><span class="lesson-status">${lessonDone(l.id)?'✓':''}</span><span><strong>${esc(l.title)}</strong><small>${esc(l.summary)}</small></span></button>`).join('')}</div></div></article>`;
      }).join('')}</div>`;
  }

  function openLesson(id){
    const found=findLesson(id); if(!found)return;
    state.recentLesson=id; save();
    const {module,lesson:l}=found;
    openModal(l.title,`<article class="lesson-detail"><span class="badge">${esc(module.title)}</span><p class="concept">${esc(l.concept)}</p><h3>Key points</h3><ul class="keypoints">${l.keyPoints.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>Example</h3><pre class="code">${esc(l.example)}</pre><h3>Practice on your device</h3><p>${esc(l.exercise)}</p><h3>Check yourself</h3><p class="prompt">${esc(l.check.q)}</p><div class="option-list" data-lesson-check="${l.id}">${l.check.options.map((o,i)=>`<button class="option" data-lesson-answer="${i}">${esc(o)}</button>`).join('')}</div><div id="lessonFeedback"></div><div class="button-row" style="margin-top:18px"><button class="${lessonDone(l.id)?'secondary':'primary'}" data-toggle-lesson="${l.id}">${lessonDone(l.id)?'Marked understood':'Mark understood'}</button><button class="ghost" data-bookmark="${l.id}">${state.bookmarks.includes(l.id)?'Remove bookmark':'Bookmark'}</button></div><div class="button-row" style="margin-top:10px"><a class="ghost small-btn" href="https://docs.godotengine.org/en/stable/search.html?q=${encodeURIComponent(l.docsQuery||l.title)}" target="_blank" rel="noopener">Godot docs ↗</a><a class="ghost small-btn" href="https://docs.godotengine.org/en/stable/search.html?q=${encodeURIComponent(module.title)}" target="_blank" rel="noopener">Module docs ↗</a></div><div class="source">Basis: ${esc(l.source)} · Written against Godot ${GODOT_TARGET} — verify in Xogot</div></article>`);
  }

  function handleLessonAnswer(btn){
    const list=btn.closest('[data-lesson-check]'); const id=list.dataset.lessonCheck; const l=findLesson(id).lesson; const selected=Number(btn.dataset.lessonAnswer);
    $$('[data-lesson-answer]',list).forEach((b,i)=>{b.disabled=true;b.classList.toggle('correct',i===l.check.answer);b.classList.toggle('wrong',i===selected&&i!==l.check.answer);});
    $('#lessonFeedback').innerHTML=`<div class="answer-box ${selected===l.check.answer?'good':'bad'}"><strong>${selected===l.check.answer?'Correct':'Review this'}</strong><p>${esc(l.check.explanation)}</p></div>`;
  }

  function practiceCategories(){return ['All','Beyond lessons',...new Set(DATA.practice.map(q=>q.category))];}
  function poolFor(filter){
    if(filter==='Beyond lessons')return DATA.practice.filter(q=>!q.lessonId);
    if(filter==='All')return DATA.practice;
    return DATA.practice.filter(q=>q.category===filter);
  }
  function resetPracticeQueue(filter=practiceFilter, specificId=null){
    practiceFilter=filter; state.preferences.practiceCategory=filter; save();
    const pool=poolFor(filter);
    const due=pool.filter(q=>state.srs[q.id]&&srsDueIn(q.id)<=0)
                  .sort((a,b)=>state.srs[a.id].due-state.srs[b.id].due);
    const fresh=shuffle(pool.filter(q=>!state.srs[q.id]));
    const ahead=pool.filter(q=>state.srs[q.id]&&srsDueIn(q.id)>0)
                    .sort((a,b)=>state.srs[a.id].due-state.srs[b.id].due);
    let queue=[...due,...fresh,...ahead].slice(0,Math.min(SESSION_SIZE,pool.length));
    if(specificId){
      const q=DATA.practice.find(x=>x.id===specificId);
      if(q)queue=[q,...queue.filter(x=>x.id!==q.id)].slice(0,SESSION_SIZE);
    }
    practiceQueue=queue;practiceIndex=0;practiceAnswered=false;
    session={correct:0,wrong:0,answered:0};
  }
  function sessionSummaryHTML(){
    const s=srsStats();
    return '<article class="card practice-shell"><h2 class="prompt">Session complete</h2>'+
      '<p class="muted">'+session.correct+' correct · '+session.wrong+' to review again.</p>'+
      '<div class="srs-summary"><span class="srs-pill due">'+s.due+' still due</span>'+
      '<span class="srs-pill">'+s.unseen+' never seen</span>'+
      '<span class="srs-pill">'+s.mature+' on long intervals</span></div>'+
      '<div class="button-row" style="margin-top:16px">'+
      '<button class="primary" data-new-session>Start another session</button>'+
      '<button class="ghost" data-go="labs">Go build something instead</button></div></article>';
  }
  function renderPractice(){
    if(!practiceQueue.length) resetPracticeQueue(state.preferences.practiceCategory||'All');
    $('#view-practice').innerHTML=`<div class="page-head"><div class="eyebrow">Active practice</div><h1>Think before the app explains</h1><p>These drills train code reading, debugging, system order, math, architecture, and project-specific combat reasoning.</p><div class="srs-summary">${(()=>{const s=srsStats();return `<span class="srs-pill due">${s.due} due</span><span class="srs-pill">${s.unseen} new</span><span class="srs-pill">${s.mature} learned</span>`})()}</div></div><div class="filter-row">${practiceCategories().map(c=>`<button class="chip ${c===practiceFilter?'active':''}" data-practice-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div><div id="practiceCard"></div>`;
    renderPracticeCard();
  }
  function renderPracticeCard(){
    const host=$('#practiceCard'); if(!host)return;
    const q=currentQ(); practiceAnswered=false;
    if(!q){host.innerHTML=sessionSummaryHTML();return;}
    let input='';
    if(q.code) input+=`<pre class="code">${esc(q.code)}</pre>`;
    if(q.type==='choice') input+=`<div class="option-list">${q.options.map((o,i)=>`<button class="option" data-practice-answer="${i}">${esc(o)}</button>`).join('')}</div>`;
    else if(q.type==='predict'||q.type==='fill') input+=`<input class="text-answer" id="practiceTextAnswer" autocomplete="off" placeholder="Type your answer"><button class="primary" data-check-text-answer>Check answer</button><button class="ghost" data-reveal-answer>Reveal</button>`;
    else if(q.type==='order'){
      const shuffled=q.items.map((text,original)=>({text,original})).sort(()=>Math.random()-.5);
      input+=`<div class="order-list" id="orderList">${shuffled.map(x=>`<div class="order-item" data-original="${x.original}"><span>${esc(x.text)}</span><div class="order-controls"><button data-move-order="up">↑</button><button data-move-order="down">↓</button></div></div>`).join('')}</div><button class="primary" data-check-order style="margin-top:10px">Check order</button>`;
    }
    host.innerHTML=`<article class="card practice-shell"><div class="practice-top"><span class="badge">${esc(q.category)}</span><span class="muted">${practiceIndex+1} / ${practiceQueue.length}</span></div><div class="srs-line"><span class="srs-pill ${state.srs[q.id]?'':'new'}">${esc(srsLabel(q.id))}</span><span class="srs-pill muted-pill">${q.lessonId?'Also a lesson check':'Beyond lessons'}</span></div><h2 class="prompt">${esc(q.prompt)}</h2>${input}<div id="practiceFeedback"></div><div class="button-row" style="margin-top:16px"><button class="secondary" data-next-practice>${practiceIndex+1>=practiceQueue.length?'Finish session':'Next'}</button>${q.lessonId?`<button class="ghost" data-open-lesson="${q.lessonId}">Open lesson</button>`:''}</div></article>`;
  }
  function finishPractice(q,correct,message){
    practiceAnswered=true;
    srsRecord(q.id,correct);
    session.answered++; if(correct)session.correct++; else session.wrong++;
    if(correct&&!state.completedPractice.includes(q.id))state.completedPractice.push(q.id);
    save();
    $('#practiceFeedback').innerHTML=`<div class="answer-box ${correct?'good':'bad'}"><strong>${correct?'Correct':'Answer'}</strong><p>${esc(message||q.explanation)}</p>${!correct&&q.answerText?`<p><strong>Expected:</strong> ${esc(q.answerText)}</p>`:''}</div>`;
  }
  function checkTextAnswer(reveal=false){
    const q=currentQ(); const entered=($('#practiceTextAnswer')?.value||'').trim().toLowerCase();
    const norm=s=>String(s).trim().toLowerCase().replace(/\s+/g,'').replace(/[()<>\[\]]/g,'').replace(/^(-?\d+)\.0+$/,'$1');
    const accepted=[...(q.accepted||[]),q.answerText].filter(Boolean).map(norm);
    const correct=!reveal&&entered!==''&&accepted.includes(norm(entered));
    finishPractice(q,correct,q.explanation);
  }

  function renderBuild(){
    const levels=['All',...new Set(DATA.missions.map(m=>m.level))];
    $('#view-build').innerHTML=`<div class="page-head"><div class="eyebrow">Build missions</div><h1>Use the phone to make real development progress</h1><p>Xogot missions create working Godot systems. Design missions create specifications, node trees, tests, and debugging plans that transfer to the laptop.</p></div><div class="filter-row" id="missionFilters">${levels.map((l,i)=>`<button class="chip ${i===0?'active':''}" data-mission-filter="${esc(l)}">${esc(l)}</button>`).join('')}</div><div class="grid desktop-two" id="missionGrid">${missionCards(DATA.missions)}</div>`;
  }
  function missionCards(list){return list.map(m=>`<article class="card mission-card"><div class="mission-head"><div><span class="badge">${esc(m.level)}</span><h2>${esc(m.title)}</h2></div>${missionDone(m.id)?'<span class="success-text">✓ Complete</span>':''}</div><p>${esc(m.objective)}</p><div class="tags"><span class="tag">${esc(m.device)}</span><span class="tag">${esc(m.duration)}</span></div><button class="primary" data-open-mission="${m.id}">Open mission</button></article>`).join('');}
  function openMission(id){const m=DATA.missions.find(x=>x.id===id);if(!m)return;openModal(m.title,`<article class="mission-detail"><div class="tags"><span class="tag">${esc(m.level)}</span><span class="tag">${esc(m.device)}</span><span class="tag">${esc(m.duration)}</span></div><h3>Objective</h3><p>${esc(m.objective)}</p><h3>Steps</h3><ol class="steps">${m.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${m.starter?`<h3>Starter code</h3><pre class="code">${esc(m.starter)}</pre><button class="ghost small-btn" data-copy="${encodeURIComponent(m.starter)}">Copy code</button>`:''}<h3>Acceptance tests</h3><ul class="checks">${m.acceptance.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><details><summary>Hint</summary><p>${esc(m.hint)}</p></details><h3>Extension</h3><p>${esc(m.extension)}</p><div class="button-row" style="margin-top:18px"><button class="${missionDone(m.id)?'secondary':'primary'}" data-toggle-mission="${m.id}">${missionDone(m.id)?'Marked complete':'Mark complete'}</button><button class="ghost" data-note-from-mission="${m.id}">Create workshop note</button></div></article>`);}

  function renderLabs(){
    const icons={attack:'⟷',defense:'⏱',vector:'↗',collision:'▦',ai:'◇',tree:'⌘',code:'{ }'};
    $('#view-labs').innerHTML=`<div class="page-head"><div class="eyebrow">Interactive laboratories</div><h1>Model systems before coding them</h1><p>These tools let you calculate, simulate, design, and save implementation-ready decisions from a phone.</p></div><div class="lab-grid">${DATA.labs.map(l=>`<article class="card lab-card interactive" data-open-lab="${l.id}"><div class="lab-icon">${icons[l.id]||'⌁'}</div><div class="content"><h2>${esc(l.title)}</h2><p>${esc(l.summary)}</p></div><span>›</span></article>`).join('')}</div>`;
  }
  function openLab(id){
    const lab=DATA.labs.find(x=>x.id===id);if(!lab)return;
    const builders={attack:attackLabHTML,defense:defenseLabHTML,vector:vectorLabHTML,collision:collisionLabHTML,ai:aiLabHTML,tree:treeLabHTML,code:codeLabHTML};
    openModal(lab.title,`<div class="lab-shell">${builders[id]()}</div>`);
    setTimeout(()=>initLab(id),0);
  }
  function attackLabHTML(){const d=state.labDesigns.attack||{name:'Gladius Light',windup:.24,active:.12,recovery:.46,damage:10,lunge:.6,chainStart:.40,chainEnd:.68,cancelStart:.62,cancelEnd:.78};return `<p class="muted">Gameplay timing is authoritative. Adjust the action, inspect the timeline, then save or copy a Resource-ready specification.</p><div class="field"><label>Attack name</label><input id="atkName" value="${esc(d.name)}"></div>${[['Wind-up','windup',0,.8,.01],['Active','active',.03,.4,.01],['Recovery','recovery',.1,1.5,.01],['Damage','damage',1,100,1],['Lunge distance (m)','lunge',0,3,.05],['Chain start','chainStart',0,2,.01],['Chain end','chainEnd',0,2,.01],['Cancel start','cancelStart',0,2,.01],['Cancel end','cancelEnd',0,2,.01]].map(([label,key,min,max,step])=>`<div class="field range-line"><div><label>${label}</label><input type="range" id="atk-${key}" min="${min}" max="${max}" step="${step}" value="${d[key]}"></div><input type="number" id="atk-${key}-num" min="${min}" max="${max}" step="${step}" value="${d[key]}"></div>`).join('')}<div id="attackTimelineOutput"></div><div class="button-row"><button class="primary" id="saveAttackDesign">Save design</button><button class="ghost" id="copyAttackDesign">Copy spec</button><button class="ghost" id="copyAttackScript">Copy AttackData</button><button class="ghost" id="copyAttackRes">Copy .tres</button></div>`;}
  function updateAttackLab(){const keys=['windup','active','recovery','damage','lunge','chainStart','chainEnd','cancelStart','cancelEnd'];const d={name:$('#atkName').value};keys.forEach(k=>d[k]=Number($(`#atk-${k}-num`).value));const total=d.windup+d.active+d.recovery;const pct=x=>Math.max(2,x/total*100);const validChain=d.chainStart<=d.chainEnd&&d.chainStart>=0&&d.chainEnd<=total;const validCancel=d.cancelStart<=d.cancelEnd&&d.cancelStart>=0&&d.cancelEnd<=total;$('#attackTimelineOutput').innerHTML=`<div class="timeline"><div class="windup" style="width:${pct(d.windup)}%">Wind-up</div><div class="active-phase" style="width:${pct(d.active)}%">Active</div><div class="recovery" style="width:${pct(d.recovery)}%">Recovery</div></div><div class="result-panel"><dl><dt>Total duration</dt><dd>${total.toFixed(2)} s</dd><dt>Active begins</dt><dd>${d.windup.toFixed(2)} s</dd><dt>Recovery begins</dt><dd>${(d.windup+d.active).toFixed(2)} s</dd><dt>Chain window</dt><dd class="${validChain?'success-text':'warning-text'}">${d.chainStart.toFixed(2)}–${d.chainEnd.toFixed(2)}</dd><dt>Cancel window</dt><dd class="${validCancel?'success-text':'warning-text'}">${d.cancelStart.toFixed(2)}–${d.cancelEnd.toFixed(2)}</dd></dl></div>${attackWarnings(d,total,validChain,validCancel)}`;return {...d,total};}
  function snake(s){return String(s).trim().replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').toLowerCase()||'attack';}
  function pascal(s){return String(s).trim().replace(/[^A-Za-z0-9]+/g,' ').split(' ').filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join('')||'Attack';}
  function attackWarnings(d,total,validChain,validCancel){
    const out=[];
    if(!validChain)out.push('Chain window falls outside the attack, or starts after it ends.');
    if(!validCancel)out.push('Cancel window falls outside the attack, or starts after it ends.');
    if(d.chainStart<d.windup+d.active)out.push('Chain window opens before the active frames end — the player can chain before the hit resolves.');
    if(d.cancelStart<d.windup+d.active)out.push('Cancel window opens during wind-up or active frames — this cancels the attack itself, not its recovery.');
    if(d.cancelEnd>total)out.push('Cancel window runs past the end of recovery, where it has no effect.');
    if(d.active<1/60)out.push('Active window is under one frame at 60 fps ('+(1/60).toFixed(3)+' s) — the hitbox may never register.');
    if(d.recovery<d.windup*0.5)out.push('Recovery is much shorter than wind-up — this attack is close to risk-free.');
    return out.length?'<ul class="warn-list">'+out.map(x=>'<li class="warning-text">'+esc(x)+'</li>').join('')+'</ul>':'<p class="success-text">No timing conflicts detected.</p>';
  }
  function attackDataScript(d){
    return ['# attack_data.gd — create this script once in your project.',
      'extends Resource',
      'class_name AttackData',
      '',
      '@export var display_name: String = ""',
      '@export var damage: int = 0',
      '@export var windup: float = 0.0',
      '@export var active: float = 0.0',
      '@export var recovery: float = 0.0',
      '@export var lunge: float = 0.0',
      '@export var chain_window: Vector2 = Vector2.ZERO',
      '@export var cancel_window: Vector2 = Vector2.ZERO',
      '',
      'func total_duration() -> float:',
      '\treturn windup + active + recovery',
      '',
      'func active_window() -> Vector2:',
      '\treturn Vector2(windup, windup + active)',
      '',
      'func can_chain(t: float) -> bool:',
      '\treturn t >= chain_window.x and t <= chain_window.y',
      '',
      'func can_cancel(t: float) -> bool:',
      '\treturn t >= cancel_window.x and t <= cancel_window.y',
      '',
      '# --- values for "'+d.name+'" ---',
      'const '+snake(d.name).toUpperCase()+' := {',
      '\t"display_name": "'+d.name+'",',
      '\t"damage": '+d.damage+',',
      '\t"windup": '+d.windup.toFixed(3)+',',
      '\t"active": '+d.active.toFixed(3)+',',
      '\t"recovery": '+d.recovery.toFixed(3)+',',
      '\t"lunge": '+d.lunge.toFixed(3)+',',
      '\t"chain_window": Vector2('+d.chainStart.toFixed(3)+', '+d.chainEnd.toFixed(3)+'),',
      '\t"cancel_window": Vector2('+d.cancelStart.toFixed(3)+', '+d.cancelEnd.toFixed(3)+'),',
      '}'].join('\n');
  }
  function attackTres(d){
    return ['[gd_resource type="Resource" script_class="AttackData" load_steps=2 format=3]','',
      '[ext_resource type="Script" path="res://attack_data.gd" id="1_attackdata"]','',
      '[resource]',
      'script = ExtResource("1_attackdata")',
      'display_name = "'+d.name+'"',
      'damage = '+d.damage,
      'windup = '+d.windup.toFixed(3),
      'active = '+d.active.toFixed(3),
      'recovery = '+d.recovery.toFixed(3),
      'lunge = '+d.lunge.toFixed(3),
      'chain_window = Vector2('+d.chainStart.toFixed(3)+', '+d.chainEnd.toFixed(3)+')',
      'cancel_window = Vector2('+d.cancelStart.toFixed(3)+', '+d.cancelEnd.toFixed(3)+')',
      ''].join('\n');   // .tres has no comment syntax — keep the payload clean
  }
  function collisionExport(m){
    const bit=n=>1<<n;
    const out=['# Project Settings → Layer Names → 3D Physics',''];
    layers.forEach((l,i)=>out.push('Layer '+(i+1)+': '+l));
    out.push('','# Per-node values (set these in the Inspector or in _ready)','');
    layers.forEach((a,i)=>{
      const mask=layers.reduce((acc,b,j)=>acc+(m[a]&&m[a][b]?bit(j):0),0);
      const sees=layers.filter(b=>m[a]&&m[a][b]);
      out.push(a+':');
      out.push('\tcollision_layer = '+bit(i)+'   # layer '+(i+1));
      out.push('\tcollision_mask  = '+mask+(sees.length?'   # sees: '+sees.join(', '):'   # sees nothing'));
    });
    out.push('','# GDScript form','');
    layers.forEach((a,i)=>{
      const mask=layers.reduce((acc,b,j)=>acc+(m[a]&&m[a][b]?bit(j):0),0);
      out.push('const '+a.toUpperCase()+'_LAYER := '+bit(i)+'\nconst '+a.toUpperCase()+'_MASK := '+mask);
    });
    return out.join('\n');
  }
  function treeTscn(){
    const used={};
    const nameFor=i=>{
      let n=String(treeWorking[i].name).replace(/[^A-Za-z0-9_ ]/g,'').trim()||('Node'+i);
      const key=treeWorking[i].parent+'/'+n;
      if(used[key]){used[key]++;n=n+used[key];}else{used[key]=1;}
      return n;
    };
    const names=treeWorking.map((_,i)=>nameFor(i));
    const pathOf=i=>{
      const parts=[];let p=treeWorking[i].parent,guard=0;
      while(p>=0&&guard++<12){parts.unshift(names[p]);p=treeWorking[p]?treeWorking[p].parent:-1;}
      parts.shift();                       // drop the root, it is implicit
      return parts.length?parts.join('/'):'.';
    };
    const out=['[gd_scene format=3]',''];
    treeWorking.forEach((n,i)=>{
      out.push(i===0
        ? '[node name="'+names[0]+'" type="'+n.type+'"]'
        : '[node name="'+names[i]+'" type="'+n.type+'" parent="'+pathOf(i)+'"]');
      out.push('');
    });
    return out.join('\n');   // .tscn has no comment syntax — keep the payload clean
  }
  function attackSpec(d){return `Attack: ${d.name}\nDamage: ${d.damage}\nWind-up: ${d.windup.toFixed(2)} s\nActive: ${d.active.toFixed(2)} s\nRecovery: ${d.recovery.toFixed(2)} s\nTotal: ${d.total.toFixed(2)} s\nLunge: ${d.lunge.toFixed(2)} m\nChain window: ${d.chainStart.toFixed(2)}–${d.chainEnd.toFixed(2)} s\nCancel window: ${d.cancelStart.toFixed(2)}–${d.cancelEnd.toFixed(2)} s`}

  function defenseLabHTML(){const d=state.labDesigns.defense||{total:.30,perfect:.12};return `<p class="muted">Press Start, then tap Defend while the marker travels across the window. Green is perfect, amber is standard, and outside the colored window is late.</p><div class="field range-line"><div><label>Total defense window</label><input id="def-total" type="range" min=".15" max=".6" step=".01" value="${d.total}"></div><input id="def-total-num" type="number" min=".15" max=".6" step=".01" value="${d.total}"></div><div class="field range-line"><div><label>Perfect portion</label><input id="def-perfect" type="range" min=".05" max=".3" step=".01" value="${d.perfect}"></div><input id="def-perfect-num" type="number" min=".05" max=".3" step=".01" value="${d.perfect}"></div><div class="reflex-track" id="reflexTrack"><div class="reflex-perfect" id="reflexPerfect"></div><div class="reflex-standard" id="reflexStandard"></div><div class="reflex-marker" id="reflexMarker" style="left:0"></div></div><div class="button-row"><button class="primary" id="startReflex">Start</button><button class="secondary" id="tapDefense">Defend</button></div><div id="reflexResult" class="result-panel">Configure the window, then start a run.</div>`;}
  function updateDefenseZones(){const total=Number($('#def-total-num').value),perfect=Math.min(total,Number($('#def-perfect-num').value));const overall=70;$('#reflexPerfect').style.width=`${overall*(perfect/total)}%`;$('#reflexStandard').style.left=`${overall*(perfect/total)}%`;$('#reflexStandard').style.width=`${overall*(1-perfect/total)}%`;state.labDesigns.defense={total,perfect};save();}
  function startReflex(){reflex.running=true;reflex.start=performance.now();reflex.duration=1000+Math.random()*700;$('#reflexResult').textContent='Wait for the marker, then tap Defend.';function frame(now){if(!reflex.running)return;const p=Math.min(1,(now-reflex.start)/reflex.duration);$('#reflexMarker').style.left=`${p*100}%`;if(p>=1){reflex.running=false;$('#reflexResult').innerHTML='<span class="warning-text">Too late. Start another run.</span>';return;}reflex.raf=requestAnimationFrame(frame);}reflex.raf=requestAnimationFrame(frame);}
  function tapDefense(){if(!reflex.running){$('#reflexResult').textContent='Press Start first.';return;}reflex.running=false;cancelAnimationFrame(reflex.raf);const p=(performance.now()-reflex.start)/reflex.duration;const total=Number($('#def-total-num').value),perfect=Number($('#def-perfect-num').value);const windowShare=.70;let result,cls;if(p<=windowShare*(perfect/total)){result='Perfect deflection';cls='success-text';}else if(p<=windowShare){result='Standard block';cls='warning-text';}else{result='Late — defense failed';cls='warning-text';}$('#reflexResult').innerHTML=`<strong class="${cls}">${result}</strong><br><span class="muted">Input at ${(p*reflex.duration/1000).toFixed(3)} s of this visual run. Project window: perfect ${perfect.toFixed(2)} s, total ${total.toFixed(2)} s.</span>`;}

  function vectorLabHTML(){return `<p class="muted">Drag the player and target. The lab shows the direction from player to target, distance, unit direction, and alignment between player facing and target direction.</p><canvas class="vector-canvas" id="vectorCanvas"></canvas><div id="vectorReadout" class="result-panel"></div><div class="field"><label>Player facing angle</label><input id="facingAngle" type="range" min="-180" max="180" value="0"></div>`;}
  function initVectorLab(){const canvas=$('#vectorCanvas');const ctx=canvas.getContext('2d');let points={player:{x:.30,y:.58},target:{x:.72,y:.36}},drag=null;function resize(){const r=canvas.getBoundingClientRect();canvas.width=Math.floor(r.width*devicePixelRatio);canvas.height=Math.floor(r.height*devicePixelRatio);ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);draw();}function pos(evt){const r=canvas.getBoundingClientRect();return{x:(evt.clientX-r.left)/r.width,y:(evt.clientY-r.top)/r.height};}function nearest(p){for(const k of ['player','target']){const q=points[k];if(Math.hypot(p.x-q.x,p.y-q.y)<.12)return k;}return null;}canvas.addEventListener('pointerdown',e=>{drag=nearest(pos(e));canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=pos(e);points[drag]={x:Math.max(.04,Math.min(.96,p.x)),y:Math.max(.06,Math.min(.94,p.y))};draw()});canvas.addEventListener('pointerup',()=>drag=null);$('#facingAngle').addEventListener('input',draw);function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#2f2824';ctx.lineWidth=1;for(let x=0;x<w;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}const P={x:points.player.x*w,y:points.player.y*h},T={x:points.target.x*w,y:points.target.y*h};const dx=T.x-P.x,dy=T.y-P.y,dist=Math.hypot(dx,dy),nx=dx/dist,ny=dy/dist;const a=Number($('#facingAngle').value)*Math.PI/180,fx=Math.cos(a),fy=Math.sin(a);const dot=fx*nx+fy*ny;ctx.strokeStyle='#e7a45f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(T.x,T.y);ctx.stroke();ctx.strokeStyle='#78a9d1';ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(P.x+fx*65,P.y+fy*65);ctx.stroke();for(const [q,color,label] of [[P,'#d96c3c','Player'],[T,'#79b98a','Target']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(q.x,q.y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f4eee9';ctx.font='12px sans-serif';ctx.fillText(label,q.x+17,q.y+4)}$('#vectorReadout').innerHTML=`<dl><dt>Screen direction</dt><dd>(${dx.toFixed(1)}, ${dy.toFixed(1)})</dd><dt>Distance</dt><dd>${dist.toFixed(1)}</dd><dt>Normalized</dt><dd>(${nx.toFixed(3)}, ${ny.toFixed(3)})</dd><dt>Facing dot</dt><dd>${dot.toFixed(3)}</dd><dt>Interpretation</dt><dd>${dot>.7?'Target mostly ahead':dot<-.7?'Target mostly behind':'Target is to the side'}</dd></dl>`;}window.addEventListener('resize',resize,{once:true});resize();}

  const layers=['world','player_body','enemy_body','player_hurtbox','enemy_hurtbox','player_weapon','enemy_weapon','guard_volume'];
  function defaultMatrix(){const m={};layers.forEach(a=>{m[a]={};layers.forEach(b=>m[a][b]=false)});m.player_body.world=m.player_body.enemy_body=true;m.enemy_body.world=m.enemy_body.player_body=true;m.player_weapon.enemy_hurtbox=m.player_weapon.enemy_weapon=m.player_weapon.guard_volume=true;m.enemy_weapon.player_hurtbox=m.enemy_weapon.player_weapon=m.enemy_weapon.guard_volume=true;return m;}
  function collisionLabHTML(){const saved=state.labDesigns.collision||defaultMatrix();return `<p class="muted">Rows are the detecting object’s mask; columns are the layer it checks. Configure the core duel matrix, then run validation.</p><div class="matrix"><table><thead><tr><th>Mask \ Layer</th>${layers.map(l=>`<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${layers.map(a=>`<tr><th>${esc(a)}</th>${layers.map(b=>`<td><input type="checkbox" data-mask="${a}" data-layer="${b}" ${saved[a]?.[b]?'checked':''}></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="button-row" style="margin-top:12px"><button class="primary" id="validateCollision">Validate core rules</button><button class="ghost" id="resetCollision">Load project defaults</button><button class="ghost" id="copyCollision">Copy layer values</button></div><div id="collisionResult"></div>`;}
  function readMatrix(){const m={};layers.forEach(a=>{m[a]={};layers.forEach(b=>m[a][b]=!!$(`[data-mask="${a}"][data-layer="${b}"]`).checked)});return m;}
  function validateCollision(){const m=readMatrix(),issues=[];if(!m.player_weapon.enemy_hurtbox)issues.push('Player weapon cannot detect enemy hurtboxes.');if(m.player_weapon.player_hurtbox)issues.push('Player weapon incorrectly detects player hurtboxes.');if(!m.enemy_weapon.player_hurtbox)issues.push('Enemy weapon cannot detect player hurtboxes.');if(m.enemy_weapon.enemy_hurtbox)issues.push('Enemy weapon incorrectly detects enemy hurtboxes.');if(!m.player_weapon.enemy_weapon||!m.enemy_weapon.player_weapon)issues.push('Weapon-vs-weapon detection is incomplete.');if(!m.player_weapon.guard_volume||!m.enemy_weapon.guard_volume)issues.push('A weapon cannot detect guard volume.');state.labDesigns.collision=m;save();$('#collisionResult').innerHTML=`<div class="answer-box ${issues.length?'bad':'good'}"><strong>${issues.length?`${issues.length} issue(s)`:'Core rules pass'}</strong>${issues.length?`<ul>${issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>The matrix satisfies the essential duel relationships.</p>'}</div>`;}

  function aiLabHTML(){const d=state.labDesigns.ai||{distance:2.5,health:100,airborne:false,attackReady:true,aggression:55,defense:25,retreat:20};return `<p class="muted">Adjust visible game state and decision weights. The simulator first filters invalid intentions, then chooses the highest current score so the reasoning remains inspectable.</p>${[['Distance to player','distance',0,20,.1],['Enemy health %','health',0,100,1],['Aggression weight','aggression',0,100,1],['Defense weight','defense',0,100,1],['Retreat weight','retreat',0,100,1]].map(([label,key,min,max,step])=>`<div class="field range-line"><div><label>${label}</label><input id="ai-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${d[key]}"></div><input id="ai-${key}-num" type="number" min="${min}" max="${max}" step="${step}" value="${d[key]}"></div>`).join('')}<div class="field"><label><input id="ai-airborne" type="checkbox" ${d.airborne?'checked':''}> Player is airborne</label></div><div class="field"><label><input id="ai-ready" type="checkbox" ${d.attackReady?'checked':''}> Enemy attack is ready</label></div><div id="aiResult" class="result-panel"></div><button class="primary" id="saveAiDesign">Save situation</button>`;}
  function updateAiLab(){const d={};['distance','health','aggression','defense','retreat'].forEach(k=>d[k]=Number($(`#ai-${k}-num`).value));d.airborne=$('#ai-airborne').checked;d.attackReady=$('#ai-ready').checked;let stateName,reason;if(d.airborne){stateName='RETREAT / HOLD';reason='Project rule: back away from airborne player, then punish landing recovery.';}else if(d.distance>6){stateName='APPROACH';reason='Target is outside preferred combat distance.';}else if(d.health<25&&d.retreat>=d.aggression){stateName='RETREAT';reason='Low health amplifies retreat preference.';}else if(d.distance<3&&d.attackReady&&d.aggression>=d.defense){stateName='ATTACK';reason='Target is in range, attack is ready, and aggression leads.';}else if(d.distance<3&&d.defense>d.aggression){stateName='DEFEND / CIRCLE';reason='Close range, but defense weight exceeds aggression.';}else{stateName='CIRCLE';reason='Within engagement range but no higher-priority valid action wins.';}$('#aiResult').innerHTML=`<dl><dt>Chosen intention</dt><dd>${stateName}</dd><dt>Reason</dt><dd>${reason}</dd><dt>Fair information used</dt><dd>distance, health, airborne state, readiness, weights</dd></dl>`;return d;}

  function treeLabHTML(){const saved=state.labDesigns.tree||[{name:'Combatant',type:'CharacterBody3D',parent:-1},{name:'CollisionShape3D',type:'CollisionShape3D',parent:0},{name:'Visuals',type:'Node3D',parent:0}];return `<p class="muted">Add nodes and assign parents. The exported tree is a design artifact you can paste into a project plan or AI prompt.</p><div class="grid two"><div class="field"><label>Node name</label><input id="nodeName" value="HealthComponent"></div><div class="field"><label>Node type</label><select id="nodeType">${['Node','Node3D','CharacterBody3D','Area3D','CollisionShape3D','MeshInstance3D','AnimationPlayer','AnimationTree','BoneAttachment3D','Camera3D','SpringArm3D'].map(x=>`<option>${x}</option>`).join('')}</select></div></div><div class="field"><label>Parent</label><select id="nodeParent"></select></div><button class="primary" id="addNode">Add node</button><div class="node-builder" id="nodeBuilder" style="margin-top:13px"></div><div class="button-row" style="margin-top:13px"><button class="secondary" id="copyNodeTree">Copy tree</button><button class="ghost" id="saveNodeTree">Save tree</button><button class="ghost" id="copyTscn">Copy .tscn</button></div>`;}
  let treeWorking=[];
  function renderTreeBuilder(){const host=$('#nodeBuilder'),parent=$('#nodeParent');parent.innerHTML=treeWorking.map((n,i)=>`<option value="${i}">${esc(n.name)} (${esc(n.type)})</option>`).join('');function depth(i){let d=0,p=treeWorking[i].parent;while(p>=0&&d<10){d++;p=treeWorking[p]?.parent??-1}return d;}host.innerHTML=treeWorking.map((n,i)=>`<div class="node-item" style="--indent:${depth(i)*16}px"><span class="indent"></span><span><strong>${esc(n.name)}</strong> <small class="muted">${esc(n.type)}</small></span>${i?`<button class="danger small-btn" data-remove-node="${i}">×</button>`:''}</div>`).join('');}
  function treeText(){function depth(i){let d=0,p=treeWorking[i].parent;while(p>=0&&d<10){d++;p=treeWorking[p]?.parent??-1}return d;}return treeWorking.map((n,i)=>`${'    '.repeat(depth(i))}${depth(i)?'└── ':''}${n.name} (${n.type})`).join('\n');}

  function codeLabHTML(){return `<p class="muted">Use this for pseudocode, short GDScript functions, AI prompts, acceptance tests, or code you plan to paste into Xogot. It does not execute GDScript.</p><div class="field"><label>Scratchpad</label><textarea id="scratchpad" class="scratchpad" spellcheck="false" placeholder="func can_attack() -> bool:\n    ...">${esc(state.scratchpad)}</textarea></div><div class="button-row"><button class="primary" id="saveScratchpad">Save locally</button><button class="secondary" id="copyScratchpad">Copy</button><button class="ghost" id="insertTemplate">Insert function template</button></div>`;}

  function initLab(id){
    if(id==='attack'){
      const keys=['windup','active','recovery','damage','lunge','chainStart','chainEnd','cancelStart','cancelEnd'];keys.forEach(k=>{const r=$(`#atk-${k}`),n=$(`#atk-${k}-num`);r.addEventListener('input',()=>{n.value=r.value;updateAttackLab()});n.addEventListener('input',()=>{r.value=n.value;updateAttackLab()})});$('#atkName').addEventListener('input',updateAttackLab);updateAttackLab();$('#saveAttackDesign').onclick=()=>{state.labDesigns.attack=updateAttackLab();save('Attack design saved')};$('#copyAttackDesign').onclick=()=>copyText(attackSpec(updateAttackLab()));$('#copyAttackScript').onclick=()=>copyText(attackDataScript(updateAttackLab()));$('#copyAttackRes').onclick=()=>{const d=updateAttackLab();copyText(attackTres(d));toast('Copied — save as res://attacks/'+snake(d.name)+'.tres');};
    } else if(id==='defense'){
      for(const k of ['total','perfect']){const r=$(`#def-${k}`),n=$(`#def-${k}-num`);r.addEventListener('input',()=>{n.value=r.value;updateDefenseZones()});n.addEventListener('input',()=>{r.value=n.value;updateDefenseZones()})}updateDefenseZones();$('#startReflex').onclick=startReflex;$('#tapDefense').onclick=tapDefense;
    } else if(id==='vector') initVectorLab();
    else if(id==='collision'){$('#validateCollision').onclick=validateCollision;$('#copyCollision').onclick=()=>copyText(collisionExport(readMatrix()));$('#resetCollision').onclick=()=>{state.labDesigns.collision=defaultMatrix();save();openLab('collision')}}
    else if(id==='ai'){
      for(const k of ['distance','health','aggression','defense','retreat']){const r=$(`#ai-${k}`),n=$(`#ai-${k}-num`);r.addEventListener('input',()=>{n.value=r.value;updateAiLab()});n.addEventListener('input',()=>{r.value=n.value;updateAiLab()})}$('#ai-airborne').addEventListener('change',updateAiLab);$('#ai-ready').addEventListener('change',updateAiLab);updateAiLab();$('#saveAiDesign').onclick=()=>{state.labDesigns.ai=updateAiLab();save('AI situation saved')};
    } else if(id==='tree'){
      treeWorking=JSON.parse(JSON.stringify(state.labDesigns.tree||[{name:'Combatant',type:'CharacterBody3D',parent:-1},{name:'CollisionShape3D',type:'CollisionShape3D',parent:0},{name:'Visuals',type:'Node3D',parent:0}]));renderTreeBuilder();$('#addNode').onclick=()=>{const name=$('#nodeName').value.trim();if(!name)return;treeWorking.push({name,type:$('#nodeType').value,parent:Number($('#nodeParent').value)});$('#nodeName').value='';renderTreeBuilder()};$('#copyNodeTree').onclick=()=>copyText(treeText());$('#copyTscn').onclick=()=>{copyText(treeTscn());toast('Copied — save as a .tscn file, then open it in Xogot');};$('#saveNodeTree').onclick=()=>{state.labDesigns.tree=treeWorking;save('Node tree saved')};
    } else if(id==='code'){$('#saveScratchpad').onclick=()=>{state.scratchpad=$('#scratchpad').value;save('Scratchpad saved')};$('#copyScratchpad').onclick=()=>copyText($('#scratchpad').value);$('#insertTemplate').onclick=()=>{$('#scratchpad').value+=`${$('#scratchpad').value?'\n\n':''}func try_action() -> bool:\n    if not can_act():\n        return false\n    # Start action here\n    return true\n`;};}
  }

  function renderReference(){
    $('#view-reference').innerHTML=`<div class="page-head"><div class="eyebrow">Searchable reference</div><h1>Look up the term, then return to the work</h1><p>A concise glossary and project rules for the concepts most likely to interrupt development.</p></div><div class="reference-search"><input id="referenceSearch" type="search" placeholder="Search glossary…"></div><div id="termList">${termHTML(DATA.glossary)}</div><div class="section-title"><h2>Project rules carried into training</h2></div><div class="grid desktop-two"><article class="card"><h3>Timing</h3><p>Combat timing is expressed in seconds and advanced in the fixed physics update. Animation playback is adjusted to fit authored gameplay timing.</p></article><article class="card"><h3>Movement</h3><p>CharacterBody3D and code-controlled movement are the default. Locomotion animation generally plays in place.</p></article><article class="card"><h3>AI fairness</h3><p>Enemy AI observes visible game state and requests the same public combat actions. It does not read raw player input.</p></article><article class="card"><h3>Phase gates</h3><p>Movement, lock-on, combat, defense, AI, and reset are manually verified before dependent work begins.</p></article></div>`;
    $('#referenceSearch').addEventListener('input',e=>{const q=e.target.value.toLowerCase();$('#termList').innerHTML=termHTML(DATA.glossary.filter(t=>(t.term+' '+t.definition).toLowerCase().includes(q)))});
  }
  function termHTML(list){return list.length?list.map(t=>`<div class="term"><strong>${esc(t.term)}</strong><p>${esc(t.definition)}</p></div>`).join(''):'<div class="empty">No matching terms.</div>';}

  function renderNotes(){
    $('#view-notes').innerHTML=`<div class="page-head"><div class="eyebrow">Workshop notes</div><h1>Capture decisions, bugs, and implementation plans</h1><p>Notes remain local to this device and are included in JSON backups.</p></div><article class="card"><div class="field"><label>Title</label><input id="noteTitle" placeholder="Example: Lock-on camera test"></div><div class="field"><label>Note</label><textarea id="noteBody" placeholder="Observed behavior, hypothesis, design, acceptance tests…"></textarea></div><button class="primary" id="addNote">Save note</button></article><div class="section-title"><h2>Saved notes</h2></div><div class="notes-list">${state.notes.length?state.notes.slice().reverse().map(n=>`<article class="note-card"><div class="note-head"><div><strong>${esc(n.title)}</strong><time>${new Date(n.created).toLocaleString()}</time></div><button class="danger small-btn" data-delete-note="${n.id}">Delete</button></div><p>${esc(n.body).replace(/\n/g,'<br>')}</p></article>`).join(''):'<div class="empty">No notes yet.</div>'}</div>`;
    $('#addNote').onclick=()=>{const title=$('#noteTitle').value.trim(),body=$('#noteBody').value.trim();if(!title&&!body)return;state.notes.push({id:Date.now(),title:title||'Untitled note',body,created:new Date().toISOString()});save('Note saved');renderNotes()};
  }

  function renderSettings(){
    $('#view-settings').innerHTML=`<div class="page-head"><div class="eyebrow">Settings and backup</div><h1>Keep the app local and portable</h1><p>No account is required. Export backups occasionally because iOS can remove website storage under some device-cleanup conditions.</p></div><div class="grid desktop-two"><article class="card"><h2>Backup</h2><p>Downloads lessons, exercise completions, missions, notes, scratchpad, and lab designs as JSON.</p><div class="button-row" style="margin-top:12px"><button class="primary" id="exportData">Export backup</button><button class="secondary" id="importData">Import backup</button></div></article><article class="card"><h2>Learning data</h2><p>${state.completedLessons.length} lessons marked understood · ${state.completedPractice.length} practice items answered correctly · ${state.completedMissions.length} missions marked complete.</p><button class="danger" id="resetData" style="margin-top:12px">Reset local data</button></article><article class="card"><h2>Review scheduling</h2><p>${(()=>{const s=srsStats();return `${s.tracked} of ${s.total} items scheduled · ${s.due} due now · ${s.unseen} never seen · ${s.mature} on long intervals.`})()}</p><button class="secondary" id="resetSrs" style="margin-top:12px">Reset review scheduling</button></article><article class="card"><h2>App version</h2><p>Mars Combat Academy ${esc(DATA.version)} — learning-first rebuild.</p></article><article class="card"><h2>Install update</h2><p>After replacing the GitHub files, open the website in Safari. The installed Home Screen app should update after the new service worker loads; closing and reopening it may be required.</p></article></div>`;
    $('#resetSrs').onclick=()=>{if(confirm('Clear review scheduling? Notes, lab designs and completions are kept.')){state.srs={};save('Review scheduling cleared');renderSettings();}};
    $('#exportData').onclick=exportData;$('#importData').onclick=()=>$('#importFile').click();$('#resetData').onclick=()=>{if(confirm('Delete all local Mars Academy data on this device?')){state=initialState();save();renderSettings();toast('Local data reset')}};
  }
  function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`mars-academy-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
  function importData(file){const r=new FileReader();r.onload=()=>{try{state={...initialState(),...JSON.parse(r.result)};save('Backup imported');renderView(view)}catch(e){alert('That file is not a valid Mars Academy backup.')}};r.readAsText(file);}

  function openSearch(){const panel=$('#searchPanel');panel.hidden=false;$('#globalSearch').value='';$('#searchResults').innerHTML='<div class="empty">Search lessons, glossary terms, and missions.</div>';setTimeout(()=>$('#globalSearch').focus(),50);}
  function searchAll(q){q=q.trim().toLowerCase();if(!q)return[];const out=[];allLessons().forEach(l=>{if((l.title+' '+l.summary+' '+l.concept).toLowerCase().includes(q))out.push({type:'Lesson',title:l.title,subtitle:l.moduleTitle,id:l.id,action:'lesson'})});DATA.missions.forEach(m=>{if((m.title+' '+m.objective+' '+m.steps.join(' ')).toLowerCase().includes(q))out.push({type:'Mission',title:m.title,subtitle:m.device,id:m.id,action:'mission'})});DATA.glossary.forEach(t=>{if((t.term+' '+t.definition).toLowerCase().includes(q))out.push({type:'Term',title:t.term,subtitle:t.definition,id:t.term,action:'term'})});return out.slice(0,40);}

  document.addEventListener('click',e=>{
    const b=e.target.closest('button,[data-go],[data-open-lab]');if(!b)return;
    if(b.dataset.view)showView(b.dataset.view);
    else if(b.dataset.go)showView(b.dataset.go);
    else if(b.dataset.openLesson)openLesson(b.dataset.openLesson);
    else if(b.dataset.quickPractice){resetPracticeQueue('All',b.dataset.quickPractice);showView('practice');}
    else if(b.dataset.lessonAnswer!==undefined)handleLessonAnswer(b);
    else if(b.dataset.toggleLesson){toggleInArray(state.completedLessons,b.dataset.toggleLesson);save();openLesson(b.dataset.toggleLesson);}
    else if(b.dataset.bookmark){toggleInArray(state.bookmarks,b.dataset.bookmark);save('Bookmark updated');openLesson(b.dataset.bookmark);}
    else if(b.dataset.practiceFilter){resetPracticeQueue(b.dataset.practiceFilter);renderPractice();}
    else if(b.dataset.practiceAnswer!==undefined&&!practiceAnswered){const q=currentQ(),selected=Number(b.dataset.practiceAnswer);$$('[data-practice-answer]').forEach((x,i)=>{x.disabled=true;x.classList.toggle('correct',i===q.answer);x.classList.toggle('wrong',i===selected&&i!==q.answer)});finishPractice(q,selected===q.answer,q.explanation);}
    else if(b.hasAttribute('data-check-text-answer'))checkTextAnswer(false);
    else if(b.hasAttribute('data-reveal-answer'))checkTextAnswer(true);
    else if(b.dataset.nextPractice!==undefined){practiceIndex++;renderPracticeCard();}
    else if(b.hasAttribute('data-new-session')){resetPracticeQueue(practiceFilter);renderPractice();}
    else if(b.dataset.moveOrder){const item=b.closest('.order-item'),list=item.parentElement;if(b.dataset.moveOrder==='up'&&item.previousElementSibling)list.insertBefore(item,item.previousElementSibling);if(b.dataset.moveOrder==='down'&&item.nextElementSibling)list.insertBefore(item.nextElementSibling,item);}
    else if(b.hasAttribute('data-check-order')){const q=currentQ();const current=$$('#orderList .order-item').map(x=>Number(x.dataset.original));finishPractice(q,current.every((v,i)=>v===q.answer[i]),q.explanation);}
    else if(b.dataset.missionFilter!==undefined){$$('[data-mission-filter]').forEach(x=>x.classList.toggle('active',x===b));const f=b.dataset.missionFilter;$('#missionGrid').innerHTML=missionCards(f==='All'?DATA.missions:DATA.missions.filter(m=>m.level===f));}
    else if(b.dataset.openMission)openMission(b.dataset.openMission);
    else if(b.dataset.toggleMission){toggleInArray(state.completedMissions,b.dataset.toggleMission);save();openMission(b.dataset.toggleMission);}
    else if(b.dataset.noteFromMission){const m=DATA.missions.find(x=>x.id===b.dataset.noteFromMission);state.notes.push({id:Date.now(),title:m.title,body:`Objective: ${m.objective}\n\nWork notes:\n\nAcceptance results:\n- ${m.acceptance.join('\n- ')}`,created:new Date().toISOString()});save('Mission note created');closeModal();showView('notes');}
    else if(b.dataset.copy)copyText(decodeURIComponent(b.dataset.copy));
    else if(b.dataset.openLab)openLab(b.dataset.openLab);
    else if(b.dataset.removeNode!==undefined){const idx=Number(b.dataset.removeNode);treeWorking.splice(idx,1);treeWorking.forEach(n=>{if(n.parent===idx)n.parent=0;else if(n.parent>idx)n.parent--});renderTreeBuilder();}
    else if(b.dataset.deleteNote){state.notes=state.notes.filter(n=>String(n.id)!==b.dataset.deleteNote);save();renderNotes();}
    else if(b.dataset.searchAction){$('#searchPanel').hidden=true;if(b.dataset.searchAction==='lesson')openLesson(b.dataset.searchId);else if(b.dataset.searchAction==='mission')openMission(b.dataset.searchId);else{showView('reference');setTimeout(()=>{$('#referenceSearch').value=b.dataset.searchId;$('#referenceSearch').dispatchEvent(new Event('input'))},20)}}
  });

  $('#menuButton').onclick=openDrawer;$('#closeDrawer').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;$('#modalClose').onclick=closeModal;$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal()});$('#searchButton').onclick=openSearch;$('#closeSearch').onclick=()=>$('#searchPanel').hidden=true;$('#globalSearch').addEventListener('input',e=>{const results=searchAll(e.target.value);$('#searchResults').innerHTML=results.length?results.map(r=>`<button class="search-result" data-search-action="${r.action}" data-search-id="${esc(r.id)}"><small>${esc(r.type)} · ${esc(r.subtitle)}</small><strong>${esc(r.title)}</strong></button>`).join(''):'<div class="empty">No results.</div>'});$('#importFile').addEventListener('change',e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value=''});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(!$('#searchPanel').hidden){$('#searchPanel').hidden=true;return;}
      if(!$('#modalBackdrop').hidden){closeModal();return;}
      if($('#drawer').classList.contains('open')){closeDrawer();return;}
    }
    const el=document.activeElement, tag=el&&el.tagName;
    const inField=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
    if(e.key==='Enter'&&inField&&el.id==='practiceTextAnswer'){e.preventDefault();checkTextAnswer(false);return;}
    if(inField)return;
    if(view!=='practice')return;
    if(!practiceAnswered&&/^[1-4]$/.test(e.key)){
      const btn=$$('[data-practice-answer]')[Number(e.key)-1];
      if(btn&&!btn.disabled){e.preventDefault();btn.click();}
    } else if(practiceAnswered&&(e.key===' '||e.key.toLowerCase()==='n')){
      const next=$('[data-next-practice]'); if(next){e.preventDefault();next.click();}
    }
  });
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  showView('home');
})();
