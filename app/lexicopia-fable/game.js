/* ============================================================================
   レキシコピア・ファブル ― ゲーム本体
   言語データ(語義・発音・派生)は 実行時に data/pie/words.json 等から引く。
   (etymon-explorer.html が埋め込んでいるものと同一のデータセット)
   ============================================================================ */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A='../assets/';
const D=window.FABLE_DATA;
const dict=o=>Object.assign(Object.create(null),o||{});
const ri=n=>Math.floor(Math.random()*n);
const pick=a=>a[ri(a.length)];

/* ===== 言語データ ===== */
let WBY=dict(), ROOTS=dict(), IPA=dict();
async function loadLex(){
  const [words,roots]=await Promise.all([
    fetch('data/pie/words.json').then(r=>r.json()),
    fetch('data/pie/roots.json').then(r=>r.json()),
  ]);
  const seen=new Set();
  for(const x of words){const k=x.w.toLowerCase();
    if(!seen.has(k)){seen.add(k);WBY[k]=x;}}
  roots.forEach(r=>ROOTS[r.key]=r);
  try{ /* 発音記号はエティモペディアの words.csv から補う(無い語は — 表示) */
    const t=await fetch('data/words.csv').then(r=>r.text());
    t.split(/\r?\n/).slice(1).forEach(l=>{const c=l.split(',');
      if(c[0]&&c[5])IPA[c[0].toLowerCase()]=c[5];});
  }catch(e){}
  /* 検証: ゲーム語は必ず語源データに実在し、語根も一致すること */
  const bad=D.words.filter(gw=>{
    const x=WBY[gw.w.toLowerCase()];
    return !x||!(x.p||[]).includes(gw.root);
  });
  if(bad.length)throw new Error('語源データ不一致: '+bad.map(b=>b.w).join(','));
}
const lex=w=>WBY[w.toLowerCase()]||{};
const gw=w=>D.words.find(x=>x.w===w);
const rootName=k=>{const e=D.etymons.find(e=>e.id===k);return e?`${e.name}（${e.ja}）`:k;};

/* ===== セーブ ===== */
const SKEY='lexicopia_fable_save';
let S=null;
function freshSave(){
  return {version:D.version, res:{food:6,wood:4,stone:2,mem:8,rep:0,meal:2},
    joined:[], revived:[], used:dict(), records:[], jobs:dict(),
    cleared:[], scene:'title', vol:70, townEvAt:Date.now()+60000, ehp:dict()};
}
function save(){ if(S)localStorage.setItem(SKEY,JSON.stringify(S)); }
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(SKEY));
    if(s&&s.version===D.version)return s;
  }catch(e){}
  return null;
}
function wipe(){localStorage.removeItem(SKEY);location.reload();}

/* ===== 共通UI ===== */
function toast(t){
  const d=document.createElement('div'); d.className='toast'; d.textContent=t;
  document.body.appendChild(d); setTimeout(()=>d.remove(),2200);
}
function modal(html,opts){
  const m=$('#modal'); m.innerHTML=`<div class="mbox">${html}</div>`;
  m.classList.add('on');
  if(!(opts&&opts.lock))m.onclick=e=>{if(e.target===m)closeModal();};
  else m.onclick=null;
  return m.querySelector('.mbox');
}
function closeModal(){$('#modal').classList.remove('on');$('#modal').innerHTML='';}
function resBar(){
  const r=S.res;
  $('#resbar').innerHTML=
    `<span>🍞食料 ${r.food}</span><span>🪵木材 ${r.wood}</span><span>🪨石材 ${r.stone}</span>`+
    `<span>📖語源記憶 ${r.mem}</span><span>⭐名声 ${r.rep}</span><span>🍱食事 ${r.meal}</span>`;
}
function gain(fx,quiet){
  for(const k in fx){
    if(k==='useWord'){useWord(fx[k]);continue;}
    if(k==='heal'||k==='scout')continue;
    S.res[k]=Math.max(0,(S.res[k]||0)+fx[k]);
  }
  resBar(); save();
  if(!quiet){const parts=Object.entries(fx).filter(([k])=>!['useWord','heal','scout'].includes(k))
    .map(([k,v])=>`${{food:'食料',wood:'木材',stone:'石材',mem:'語源記憶',rep:'名声',meal:'食事'}[k]}${v>0?'+':''}${v}`);
    if(parts.length)toast(parts.join(' '));}
}

/* ===== 復元段階 ===== */
function useWord(w){
  const g0=gw(w); if(!g0)return;
  const set=S.used[g0.root]||(S.used[g0.root]=[]);
  if(!set.includes(w)){
    set.push(w); save();
    const st=stageOf(g0.root), prev=stageOfCount(set.length-1);
    if(st>prev)toast(`✨ ${rootName(g0.root)}の復元段階が「${D.stages[st].ja}」に!`);
  }
}
function stageOfCount(n){let s=-1;D.stages.forEach((st,i)=>{if(n>=st.n)s=i;});return s;}
function stageOf(root){return stageOfCount((S.used[root]||[]).length);}

/* ===== 復活 ===== */
function revived(w){return S.revived.includes(w);}
function candidates(root){
  const all=D.words.filter(x=>x.root===root&&!revived(x.w));
  const st=stageOf(root);
  const cap=[3,6,10,99][Math.max(0,st+1)]||99;   // 段階で候補の奥行きが開く
  const pool=all.slice(0,Math.max(3,cap));
  return pool.slice(0,3);
}
function reviveUI(root){
  const cands=candidates(root);
  if(!cands.length){toast('この一族は 今はぜんぶ 復活している!');return;}
  const rows=cands.map(c=>{
    const x=lex(c.w), kin=D.words.filter(y=>y.root===root&&y.w!==c.w).slice(0,3).map(y=>y.w).join(' / ');
    const can=S.res.mem>=c.cost;
    return `<div class="wcard">
      <div class="wa"><img src="${A}word/${c.w}.png" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'${esc(c.w)}'}))"></div>
      <div class="wi">
        <b>${esc(c.w)}</b> <em>${esc(x.ja||'')}</em> <span class="ipa">${esc(IPA[c.w]||'—')}</span><br>
        <span class="tag">${esc(rootName(root))}の一族</span>
        <span class="tag">使える場所: ${c.areas.filter(a=>a!=='battle'&&a!=='town').map(areaName).join('・')||'町'}${c.btl?'・戦闘':''}</span><br>
        <span class="role">▶ ${esc(c.role)}</span><br>
        <span class="kin">同じ一族: ${esc(kin)}</span>
      </div>
      <button class="btn ${can?'':'off'}" data-w="${esc(c.w)}" ${can?'':'disabled'}>復活<br>📖${c.cost}</button>
    </div>`;}).join('');
  const bx=modal(`<h3>🌳 どの記憶を さきに 呼びもどす?</h3>
    <p class="sub">えらばなかった ことばは 消えない。あとから 復活できる。</p>${rows}
    <button class="btn ghost" onclick="closeModal()">またあとで</button>`);
  bx.querySelectorAll('button[data-w]').forEach(b=>b.onclick=()=>{
    const c=gw(b.dataset.w);
    S.res.mem-=c.cost; S.revived.push(c.w); save(); resBar();
    closeModal();
    reviveFx(c);
  });
}
function reviveFx(c){
  const x=lex(c.w);
  modal(`<h3>✨ ことばが よみがえった!</h3>
    <div class="revive"><img src="${A}word/${c.w}.png" onerror="this.style.display='none'">
    <div><b class="big">${esc(c.w)}</b>（${esc(x.ja||'')}）<br>${esc(c.revive)}</div></div>
    <button class="btn" onclick="closeModal();renderTown()">町へもどる</button>`,{lock:1});
  save();
}

/* ===== エリア ===== */
function areaName(a){return {tree:'アルファベット樹',farm:'牧場',kitchen:'厨房',
  expedition:'遠征所',library:'図書館',observatory:'観測台',plaza:'広場',market:'市場',town:'町'}[a]||a;}
function wordsInArea(a){return D.words.filter(w=>revived(w.w)&&w.areas.includes(a));}

/* ---- 各エリアのパネル(そのエリアで意味のある語だけを表示) ---- */
function openArea(a){
  if(a==='tree')return treeUI();
  if(a==='expedition')return prepUI();
  const ws=wordsInArea(a);
  let extra='';
  if(a==='farm')extra=jobsUI(['milk','honey']);
  if(a==='kitchen')extra=jobsUI(['cook']);
  if(a==='library')extra=libraryUI();
  if(a==='observatory')extra=obsUI();
  if(a==='plaza')extra=plazaUI();
  if(a==='market')extra=marketUI();
  const rows=ws.map(w=>`<div class="arow"><img src="${A}word/${w.w}.png" onerror="this.style.display='none'">
    <b>${esc(w.w)}</b><em>${esc(lex(w.w).ja||'')}</em><span>${esc(w.role)}</span></div>`).join('')
    ||'<p class="sub">ここで働くことばは まだ ねむっている。樹で復活させよう。</p>';
  modal(`<h3>${areaName(a)}</h3>${rows}${extra}
    <button class="btn ghost" onclick="closeModal()">とじる</button>`);
  bindJobBtns(); bindMisc();
}
/* 生産(時間で育つ) */
function jobsUI(ids){
  return ids.map(id=>{
    const p=D.production.find(x=>x.id===id);
    if(p.need&&!revived(p.need))return '';
    const j=S.jobs[id], now=Date.now();
    if(j&&now-j>=p.grow*1000)
      return `<div class="job done"><b>${p.name}</b> できた! <button class="btn" data-collect="${id}">回収</button></div>`;
    if(j){const left=Math.ceil((p.grow*1000-(now-j))/1000);
      return `<div class="job"><b>${p.name}</b> そだち中… のこり${left}秒</div>`;}
    const canCost=!p.cost||Object.entries(p.cost).every(([k,v])=>S.res[k]>=v);
    return `<div class="job"><b>${p.name}</b> <span class="sub">${p.ja}</span>
      <button class="btn ${canCost?'':'off'}" data-start="${id}" ${canCost?'':'disabled'}>はじめる</button></div>`;
  }).join('');
}
function bindJobBtns(){
  $$('#modal [data-start]').forEach(b=>b.onclick=()=>{
    const p=D.production.find(x=>x.id===b.dataset.start);
    if(p.cost)for(const k in p.cost)S.res[k]-=p.cost[k];
    S.jobs[p.id]=Date.now(); save(); resBar();
    toast(`${p.name} を はじめた`);
    closeModal(); openArea(p.area);
  });
  $$('#modal [data-collect]').forEach(b=>b.onclick=()=>{
    const p=D.production.find(x=>x.id===b.dataset.collect);
    delete S.jobs[p.id]; gain(p.out);
    if(p.need)useWord(p.need);
    if(p.id==='cook')useWord('chef');
    closeModal(); openArea(p.area);
  });
}
/* 図書館 */
function libraryUI(){
  const recs=S.records.slice(-6).map(r=>`<div class="rec">📄 ${esc(r)}</div>`).join('')
    ||'<p class="sub">まだ記録がない。遠征から帰ると 章をのこせる。</p>';
  let acts='';
  if(revived('fable'))acts+=`<button class="btn" data-act="readfable">fableを読む</button>`;
  if(revived('video')&&S.records.length)acts+=`<button class="btn" data-act="video">videoで再生</button>`;
  if(revived('review'))acts+=`<button class="btn" data-act="review">reviewで見直す(📖+1)</button>`;
  return `<h4>きろく</h4>${recs}<div class="btns">${acts}</div>`;
}
/* 観測台 */
function obsUI(){
  let out='<h4>観測</h4><div class="btns">';
  if(revived('view'))out+=`<button class="btn" data-act="view">viewで遠征先を見る</button>`;
  if(revived('vision'))out+=`<button class="btn" data-act="vision">visionで敵情を見る</button>`;
  if(revived('prophecy'))out+=`<button class="btn" data-act="prophecy">prophecyで兆しを読む</button>`;
  return out+'</div>';
}
/* 広場 */
let perfAt=0;
function plazaUI(){
  const acts=['fable','symphony','wizard','idol','interview','famous']
    .filter(revived).map(w=>`<button class="btn" data-perf="${w}">${w}（名声+）</button>`).join('');
  return `<h4>にぎわい</h4><div class="btns">${acts||'<span class="sub">披露できることばが まだ無い</span>'}</div>`;
}
/* 市場 */
function marketUI(){
  if(!revived('capital'))return '';
  return `<h4>こうかん(capital)</h4><div class="btns">
    <button class="btn" data-trade="f2w">食料3→木材2</button>
    <button class="btn" data-trade="w2s">木材3→石材2</button>
    <button class="btn" data-trade="s2m">石材3→📖記憶1</button></div>`;
}
function bindMisc(){
  $$('#modal [data-perf]').forEach(b=>b.onclick=()=>{
    if(Date.now()-perfAt<45000){toast('広場は さっき盛り上がったばかり。少し休もう');return;}
    perfAt=Date.now(); gain({rep:2}); useWord(b.dataset.perf);
    toast(`${b.dataset.perf} の披露に 拍手が起きた!`);
  });
  $$('#modal [data-trade]').forEach(b=>b.onclick=()=>{
    const t=b.dataset.trade;
    const deal={f2w:[['food',3],['wood',2]],w2s:[['wood',3],['stone',2]],s2m:[['stone',3],['mem',1]]}[t];
    if(S.res[deal[0][0]]<deal[0][1]){toast('たりない!');return;}
    S.res[deal[0][0]]-=deal[0][1]; S.res[deal[1][0]]+=deal[1][1];
    useWord('capital'); resBar(); save(); toast('こうかん した');
  });
  $$('#modal [data-act]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==='readfable'){useWord('fable');toast('物語のつづきが 気になる…(名声+1)');gain({rep:1},1);}
    if(a==='video'){useWord('video');modal(`<h3>🎞 video</h3><p>${esc(S.records[S.records.length-1]||'')}</p><button class="btn" onclick="closeModal()">とじる</button>`);}
    if(a==='review'){useWord('review');gain({mem:1});}
    if(a==='view'){useWord('view');const r=D.regions.find(r=>regionOpen(r));modal(`<h3>👁 view</h3><p>${esc(r.name)}: ${esc(r.ja)}。道のりは ${r.nodes.length}歩。</p><button class="btn" onclick="closeModal()">とじる</button>`);}
    if(a==='vision'){useWord('vision');const r=D.regions.find(r=>regionOpen(r));
      const es=r.enemies.map(id=>{const e=D.enemies.find(x=>x.id===id);return `${e.name}(弱点:${rootName(e.weak)})`;}).join('<br>');
      modal(`<h3>🔮 vision</h3><p>${es}</p><button class="btn" onclick="closeModal()">とじる</button>`);}
    if(a==='prophecy'){useWord('prophecy');toast('兆し:「'+pick(D.townEvents).t.slice(0,18)+'…」');}
  });
}

/* ===== アルファベット樹 ===== */
function treeUI(){
  const rows=S.joined.map(id=>{
    const e=D.etymons.find(x=>x.id===id);
    const st=stageOf(id), used=(S.used[id]||[]).length;
    const revN=D.words.filter(w=>w.root===id&&revived(w.w)).length;
    const totN=D.words.filter(w=>w.root===id).length;
    return `<div class="ety"><img src="${A}${e.img}">
      <div><b>${e.name}</b>（${e.ja} / *${id.replace(/-$/,'')}）<br>
      復元段階: <b>${st>=0?D.stages[st].ja:'ねむり'}</b>（一族のことば ${used}種をつかった）<br>
      復活 ${revN}/${totN}語</div>
      <button class="btn" data-rev="${id}">復活させる</button></div>`;
  }).join('');
  modal(`<h3>🌳 アルファベット樹</h3>${rows||'<p>まだ エティモンがいない。</p>'}
    <p class="sub">復元段階は、一族の<b>ちがう ことばを実際につかう</b>と進む。</p>
    <button class="btn ghost" onclick="closeModal()">とじる</button>`);
  $$('#modal [data-rev]').forEach(b=>b.onclick=()=>{closeModal();reviveUI(b.dataset.rev);});
}

/* ===== 町 ===== */
function regionOpen(r){return r.open||S.cleared.includes(r.openAfter);}
function renderTown(){
  S.scene='town'; save();
  $('#stagebody').innerHTML=`
    <div id="town" style="background-image:url(${A}ground/T_BG_base_ground.png)">
      <div id="blds"></div><div id="folk"></div>
      <button class="fbtn" id="bell" style="display:none">❗ 町のようす</button>
    </div>`;
  const blds=D.buildings.filter(b=>b.always||revived(b.word));
  $('#blds').innerHTML=blds.map(b=>{
    const clickable=!b.deco;
    return `<div class="bld ${b.deco?'deco':''}" data-a="${b.area}" data-n="${esc(b.name)}"
      style="left:${b.x-b.w/2}px;top:${b.y-70}px;width:${b.w}px">
      <div class="roof"></div><span>${esc(b.name)}</span></div>`;
  }).join('');
  $$('#blds .bld:not(.deco)').forEach(el=>el.onclick=()=>openArea(el.dataset.a));
  /* 住民(復活した「ひと」のことば)が歩く */
  const persons=['chef','captain','chief','wizard','idol','prophet','guide','wise','cadet','infant']
    .filter(revived);
  $('#folk').innerHTML=persons.map(w=>
    `<img class="npc" data-w="${w}" src="${A}word/${w}.png" style="left:${300+ri(1300)}px;top:${820+ri(120)}px"
     onerror="this.style.display='none'">`).join('');
  resBar();
  checkStory();
}
let walkTimer=null;
function startWalk(){
  clearInterval(walkTimer);
  walkTimer=setInterval(()=>{
    $$('#folk .npc').forEach(el=>{
      if(Math.random()<0.5)return;
      const x=300+ri(1300), flip=x<parseInt(el.style.left)?-1:1;
      el.style.left=x+'px'; el.style.top=(820+ri(140))+'px';
      el.style.transform=`scaleX(${flip})`;
    });
    /* 町イベントのベル */
    if(S&&S.scene==='town'&&revived('chief')&&Date.now()>S.townEvAt){
      const bell=$('#bell'); if(bell)bell.style.display='block';
    }
  },2600);
}
function townEvent(){
  S.townEvAt=Date.now()+90000+ri(60000); save();
  const bell=$('#bell'); if(bell)bell.style.display='none';
  const pool=D.townEvents.filter(e=>!e.need||revived(e.need));
  const ev=pick(pool);
  const bx=modal(`<h3>🏘 町のようす</h3><p>${esc(ev.t)}</p>
    <div class="btns">${ev.ch.map((c,i)=>`<button class="btn" data-c="${i}">${esc(c[0])}</button>`).join('')}</div>`,{lock:1});
  bx.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{
    gain(ev.ch[+b.dataset.c][1]); closeModal();
  });
}

/* ===== 物語進行 ===== */
function checkStory(){
  for(const j of D.script.joins){
    if(S.joined.includes(j.etymon))continue;
    const ok=j.when==='start'||S.cleared.includes(j.when);
    if(ok){joinEtymon(j);return;}
  }
}
function joinEtymon(j){
  const e=D.etymons.find(x=>x.id===j.etymon);
  S.joined.push(e.id); S.ehp[e.id]=e.hp; save();
  const bx=modal(`<h3>✨ エティモンが 目をさました</h3>
    <div class="revive"><img src="${A}${e.img}">
    <div><p>${esc(j.line)}</p><b class="big">${e.name}</b>（${e.ja} / *${e.id.replace(/-$/,'')}）<br>
    「${esc(e.intro)}」</p></div></div>
    <button class="btn" id="jk">なかまに なった!</button>`,{lock:1});
  bx.querySelector('#jk').onclick=()=>{
    closeModal();
    if(e.id==='kaput-')firstReviveTutorial();
  };
}
function firstReviveTutorial(){
  if(S.revived.length)return;
  modal(`<h3>🌳 最初の復活</h3>
    <p>カプトの一族から、まず ひとことば。<b>どの記憶を さきに 呼びもどす?</b></p>
    <button class="btn" id="go">樹の前に立つ</button>`,{lock:1})
    .querySelector('#go').onclick=()=>{closeModal();reviveUI('kaput-');};
}

/* ===== 遠征 ===== */
let X=null;   // 遠征の一時状態
function prepUI(){
  if(!revived('headquarters')&&!revived('captain')){
    modal(`<h3>🏕 遠征所</h3><p>遠征には <b>captain</b>(隊長)が要る。まず樹で復活させよう。</p>
      <button class="btn ghost" onclick="closeModal()">とじる</button>`);return;
  }
  if(!revived('captain')){
    modal(`<h3>🏕 遠征本部</h3><p><b>captain</b> がいないと 隊が出せない。</p>
      <button class="btn ghost" onclick="closeModal()">とじる</button>`);return;
  }
  const regs=D.regions.map(r=>{
    const open=regionOpen(r), done=S.cleared.includes(r.id);
    return `<button class="btn ${open?'':'off'}" data-r="${r.id}" ${open?'':'disabled'}>
      ${r.name}${done?' ✅':''}<br><span class="sub">${esc(r.ja)}</span></button>`;}).join('');
  const btlWords=D.words.filter(w=>revived(w.w)&&w.btl);
  const bws=btlWords.map(w=>`<label class="chk"><input type="checkbox" value="${w.w}">
    ${w.w}（${esc(w.btl.ja)}）</label>`).join('')||'<span class="sub">行動語なし(visionやfableを復活させると増える)</span>';
  const guideOn=revived('guide');
  const bx=modal(`<h3>🏕 遠征の編成</h3>
    <p>隊長: <b>captain</b>　案内役: ${guideOn?'<b>guide</b> ✅(道が見える)':'<span class="sub">guide未復活</span>'}<br>
    エティモン: ${S.joined.map(id=>D.etymons.find(e=>e.id===id).name).join('・')}（全員出撃）<br>
    食事(🍱): <b>${S.res.meal}</b>こ持っていく（1歩ごとに1つ。無いと きずが増える）</p>
    <h4>行動語(2つまで)</h4><div class="chks">${bws}</div>
    <h4>行き先</h4><div class="btns">${regs}</div>
    <button class="btn ghost" onclick="closeModal()">やめる</button>`);
  bx.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{
    const sel=[...bx.querySelectorAll('input:checked')].map(i=>i.value).slice(0,2);
    startExpedition(b.dataset.r, sel);
  });
}
function startExpedition(rid, btlWords){
  const r=D.regions.find(x=>x.id===rid);
  useWord('captain'); if(revived('guide'))useWord('guide');
  if(revived('cadet'))useWord('cadet');
  X={r, i:-1, btl:btlWords, uses:dict(), meals:S.res.meal, hp:dict(), loot:{mem:0,food:0,wood:0,stone:0,rep:0}};
  S.res.meal=0;
  S.joined.forEach(id=>{X.hp[id]=D.etymons.find(e=>e.id===id).hp;});
  closeModal(); nextNode();
}
function nextNode(){
  X.i++;
  const r=X.r;
  if(X.i>=r.nodes.length){return returnTown(true);}
  /* 食事 */
  if(X.meals>0)X.meals--;
  else{S.joined.forEach(id=>X.hp[id]=Math.max(1,X.hp[id]-3));}
  const t=r.nodes[X.i];
  const head=`<div class="xhead">${esc(r.name)}　${X.i+1}/${r.nodes.length}歩
    ${revived('guide')?'　みちすじ: '+r.nodes.map((n,i)=>i<X.i?'・':({b:'⚔',r:'✦',m:'📖',e:'?',s:'🏕',B:'👹'})[n]).join(''):''}
    　🍱${X.meals}　${S.joined.map(id=>`${D.etymons.find(e=>e.id===id).name}❤${X.hp[id]}`).join(' ')}</div>`;
  if(t==='b'||t==='B'){
    const eid=t==='B'?r.boss:pick(r.enemies);
    return battle(D.enemies.find(e=>e.id===eid), head, t==='B');
  }
  if(t==='r'){
    const fx={}; const kind=pick(Object.keys(r.loot));
    fx[kind]=r.loot[kind]; if(revived('biceps')&&(kind==='wood'||kind==='stone')){fx[kind]++;useWord('biceps');}
    for(const k in fx)X.loot[k]=(X.loot[k]||0)+fx[k];
    return xModal(head,`✦ 資源地点だ。${Object.entries(fx).map(([k,v])=>({food:'食料',wood:'木材',stone:'石材',mem:'語源記憶'}[k]||k)+'+'+v).join(' ')}`,'すすむ');
  }
  if(t==='m'){
    const n=2+(X.r.id==='coast'?1:0); X.loot.mem+=n;
    return xModal(head,`📖 <b>単語の記憶</b>を見つけた! 語源記憶+${n}。<br>持ち帰って アルファベット樹で ことばを呼びもどせる。`,'すすむ');
  }
  if(t==='s'){
    S.joined.forEach(id=>X.hp[id]=Math.min(D.etymons.find(e=>e.id===id).hp,X.hp[id]+8));
    return xModal(head,'🏕 休息地点。たき火で ひとやすみ(きず回復)。','すすむ');
  }
  /* イベント */
  const ev=pick(D.events);
  const bx=modal(head+`<p>${esc(ev.t)}</p><div class="btns">${
    ev.ch.map((c,i)=>`<button class="btn" data-c="${i}">${esc(c[0])}</button>`).join('')}</div>`,{lock:1});
  bx.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{
    const fx=ev.ch[+b.dataset.c][1];
    for(const k in fx){
      if(k==='heal')S.joined.forEach(id=>X.hp[id]=Math.max(1,Math.min(D.etymons.find(e=>e.id===id).hp,X.hp[id]+fx.heal)));
      else X.loot[k]=(X.loot[k]||0)+fx[k];
    }
    closeModal(); nextNode();
  });
}
function xModal(head,body,btn){
  const bx=modal(head+`<p>${body}</p><button class="btn" id="nx">${btn}</button>`,{lock:1});
  bx.querySelector('#nx').onclick=()=>{closeModal();nextNode();};
}
function returnTown(finished){
  const r=X.r;
  const clearedNow=finished&&!S.cleared.includes(r.id)&&r.nodes[r.nodes.length-1]==='B'&&X.bossDown;
  if(clearedNow)S.cleared.push(r.id);
  for(const k in X.loot)S.res[k]=(S.res[k]||0)+X.loot[k];
  if(revived('chapter')){S.records.push(`${r.name}の遠征 第${S.records.length+1}章(記憶${X.loot.mem})`);useWord('chapter');}
  save(); resBar();
  const bx=modal(`<h3>🏠 帰還</h3><p>${esc(r.name)}から 町へもどった。</p>
    <p>もちかえり: ${Object.entries(X.loot).filter(([k,v])=>v).map(([k,v])=>({food:'食料',wood:'木材',stone:'石材',mem:'📖記憶',rep:'⭐名声'}[k])+'+'+v).join(' ')||'なし'}</p>
    ${clearedNow?`<p><b>${esc(r.name)}を 踏破した!</b> あたらしい道と記憶がひらく。</p>`:''}
    <button class="btn" id="bk">町へ</button>`,{lock:1});
  bx.querySelector('#bk').onclick=()=>{
    closeModal(); X=null; renderTown();
    if(S.cleared.length>=3&&!S.gameCleared){S.gameCleared=1;save();gameClear();}
  };
}
function gameClear(){
  modal(`<h3>🌈 ジャバウォックの霧が 晴れていく</h3>
    <p>3つの地のぬしが しずまり、ことばと文明が 町にもどりはじめた。<br>
    旅はつづく ―― 町はこれからも 発展できる。のこりのことばも 呼びもどそう。</p>
    <button class="btn" onclick="closeModal()">町でくらしを続ける</button>`,{lock:1});
}

/* ===== バトル ===== */
let B=null;
function battle(en, head, isBoss){
  B={en:{...en}, hp:en.hp, sleep:0, rally:0, exposed:false, foreseen:0, round:1, isBoss, head, acted:dict()};
  drawBattle('');
}
function drawBattle(logline){
  const e=B.en;
  const weakTxt=B.exposed?`弱点: ${rootName(e.weak)}`:'弱点: ???';
  const tell=B.sleep>0?'💤 ねむっている':`つぎ: ${esc(e.tell)}（⚔${e.atk}）`;
  const party=S.joined.map(id=>{
    const et=D.etymons.find(x=>x.id===id);
    const done=B.acted[id];
    return `<button class="fighter ${done?'off':''}" data-id="${id}" ${done||X.hp[id]<=0?'disabled':''}>
      <img src="${A}${et.img}"><b>${et.name}</b>❤${X.hp[id]}${B.rally?' 🎺':''}</button>`;}).join('');
  const bws=B.btlBtns=X.btl.filter(w=>(X.uses[w]||0)<2).map(w=>
    `<button class="btn small" data-bw="${w}">${w}:${esc(gw(w).btl.ja)}(のこり${2-(X.uses[w]||0)})</button>`).join('');
  modal(`${B.head}
    <div class="brow"><div class="foe"><div class="foeimg">${e.boss?'👹':'●'}</div>
      <b>${esc(e.name)}</b> ❤${B.hp}/${e.hp}<br><span class="sub">${weakTxt}</span><br><span class="tellline">${tell}</span></div></div>
    ${logline?`<p class="blog">${logline}</p>`:''}
    <h4>だれで たたかう?(タップで通常攻撃)</h4><div class="btns">${party}</div>
    <h4>行動語</h4><div class="btns">${bws||'<span class="sub">なし</span>'}</div>`,{lock:1});
  $$('#modal .fighter').forEach(b=>b.onclick=()=>act(b.dataset.id));
  $$('#modal [data-bw]').forEach(b=>b.onclick=()=>actWord(b.dataset.bw));
}
function act(id){
  const et=D.etymons.find(x=>x.id===id);
  let d=et.atk+(B.rally?3:0);
  let line=`${et.name}の こうげき! `;
  if(B.en.weak===id){d*=2;B.exposed=true;line+='<b>こうかは ばつぐんだ!</b> ';}
  B.hp=Math.max(0,B.hp-d); B.acted[id]=1;
  line+=`${d}ダメージ。`;
  useWordFree(id);
  afterAct(line);
}
function useWordFree(rootId){ /* 一族の戦闘参加も復元段階にかぞえる(通常攻撃は語でないので数えない) */ }
function actWord(w){
  const g0=gw(w); X.uses[w]=(X.uses[w]||0)+1; useWord(w);
  let line=`「${w}」! `;
  const fx=g0.btl.fx;
  if(fx==='expose'){B.exposed=true;line+=`敵をよく見た ― <b>弱点は ${rootName(B.en.weak)}</b>だ!`;}
  if(fx==='sleep'){B.sleep=2;line+='物語に聞き入って、敵は <b>ねむってしまった</b>(2回 休み)。';}
  if(fx==='rally'){B.rally=1;line+='演奏で みんなの気合が上がった(こうげき+3)!';}
  if(fx==='foresee'){B.foreseen=2;line+='先読みした ― <b>つぎの2回、敵の攻撃をかわせる</b>。';}
  if(fx==='escape'){closeModal();toast('guide の案内で 安全な道へ逃れた');return nextNode();}
  afterAct(line);
}
function afterAct(line){
  if(B.hp<=0)return winBattle();
  const allActed=S.joined.every(id=>B.acted[id]||X.hp[id]<=0);
  if(!allActed)return drawBattle(line);
  /* 敵のターン */
  B.acted=dict();
  if(B.sleep>0){B.sleep--;return drawBattle(line+'<br>敵は ねむっている…。');}
  if(B.foreseen>0){B.foreseen--;return drawBattle(line+'<br>敵の攻撃! ― <b>先読みどおり かわした</b>。');}
  const alive=S.joined.filter(id=>X.hp[id]>0);
  const tgt=pick(alive);
  X.hp[tgt]=Math.max(0,X.hp[tgt]-B.en.atk);
  const tn=D.etymons.find(x=>x.id===tgt).name;
  if(S.joined.every(id=>X.hp[id]<=0)){return loseBattle();}
  drawBattle(line+`<br>敵のこうげき! ${tn}に ${B.en.atk}ダメージ。`);
}
function winBattle(){
  let drop={mem:B.isBoss?(B.en.drop?B.en.drop.mem:6):1};
  if(!B.isBoss&&Math.random()<0.5)drop.food=1;
  for(const k in drop)X.loot[k]=(X.loot[k]||0)+drop[k];
  if(B.isBoss)X.bossDown=true;
  const bx=modal(`${B.head}<h3>🎉 かった!</h3>
    <p>${esc(B.en.name)}は 霧にとけた。${Object.entries(drop).map(([k,v])=>({mem:'📖記憶',food:'食料'}[k])+'+'+v).join(' ')}</p>
    <button class="btn" id="nx">すすむ</button>`,{lock:1});
  bx.querySelector('#nx').onclick=()=>{closeModal();B=null;nextNode();};
}
function loseBattle(){
  const bx=modal(`<h3>💦 力つきた…</h3>
    <p>隊は なんとか 町まで 運ばれた。ひろったものの 半分を 落としてしまった。</p>
    <button class="btn" id="bk">帰還</button>`,{lock:1});
  for(const k in X.loot)X.loot[k]=Math.floor(X.loot[k]/2);
  bx.querySelector('#bk').onclick=()=>{closeModal();B=null;returnTown(false);};
}

/* ===== タイトル・序章 ===== */
function title(){
  S=load();
  const cont=S?`<button class="btn" id="cont">つづきから</button>`:'';
  $('#stagebody').innerHTML=`<div id="title">
    <h1>エティモリンゴ<br><span>レキシコピア・ファブル</span></h1>
    <p>ことばを呼びもどし、町と文明を とりもどす</p>
    <div class="btns"><button class="btn" id="new">はじめから</button>${cont}</div></div>`;
  $('#new').onclick=()=>{S=freshSave();save();prologue(0);};
  const c=$('#cont'); if(c)c.onclick=()=>{renderTown();startWalk();};
}
function prologue(i){
  const lines=D.script.prologue;
  if(i>=lines.length){renderTown();startWalk();return;}
  $('#stagebody').innerHTML=`<div id="prol"><p>${esc(lines[i])}</p><span class="nx">▼</span></div>`;
  $('#prol').onclick=()=>prologue(i+1);
}

/* ===== 設定・デバッグ・エラー ===== */
function settings(){
  const bx=modal(`<h3>⚙ 設定</h3>
    <label>音量 <input type="range" id="vol" min="0" max="100" value="${S?S.vol:70}"></label>
    <p class="sub">※ 音源はまだ仮(未実装)。設定は保存される。</p>
    <div class="btns"><button class="btn" id="dbg">🐞 デバッグ</button>
    <button class="btn ghost" id="init">セーブを消して最初から</button></div>
    <button class="btn ghost" onclick="closeModal()">とじる</button>`);
  bx.querySelector('#vol').oninput=e=>{if(S){S.vol=+e.target.value;save();}};
  bx.querySelector('#init').onclick=()=>{if(confirm('セーブを消します。いい?'))wipe();};
  bx.querySelector('#dbg').onclick=()=>{
    const b2=modal(`<h3>🐞 デバッグ</h3><div class="btns">
      <button class="btn" id="d1">資源+10</button>
      <button class="btn" id="d2">全語 復活</button>
      <button class="btn" id="d3">全地域 開放</button></div>
      <button class="btn ghost" onclick="closeModal()">とじる</button>`);
    b2.querySelector('#d1').onclick=()=>{['food','wood','stone','mem','meal'].forEach(k=>S.res[k]+=10);S.res.rep+=10;resBar();save();toast('資源+10');};
    b2.querySelector('#d2').onclick=()=>{D.words.forEach(w=>{if(!revived(w.w))S.revived.push(w.w);});save();toast('全語復活');renderTown();};
    b2.querySelector('#d3').onclick=()=>{S.cleared=['forest','city'];save();toast('地域開放');renderTown();};
  };
}
window.onerror=(m,src,l)=>{const e=$('#errbar');if(e){e.textContent=`⚠ エラー: ${m} (${l}行)`;e.style.display='block';}};

/* ===== 舞台の拡縮(1920x1080固定・箱庭と同じ) ===== */
const fitStage=()=>{
  const vw=(window.visualViewport&&visualViewport.width)||innerWidth;
  const vh=(window.visualViewport&&visualViewport.height)||innerHeight;
  $('#app').style.transform=`translate(-50%,-50%) scale(${Math.min(vw/1920,vh/1080)})`;
};
addEventListener('resize',fitStage);
if(window.visualViewport)visualViewport.addEventListener('resize',fitStage);

/* ===== 起動 ===== */
async function boot(){
  fitStage();
  try{ await loadLex(); }
  catch(e){ $('#errbar').textContent='⚠ 語源データが読めない: '+e.message; $('#errbar').style.display='block'; return; }
  $('#btnSet').onclick=settings;
  $('#btnTown').onclick=()=>{if(S&&S.scene)renderTown();};
  document.body.addEventListener('click',e=>{
    if(e.target&&e.target.id==='bell')townEvent();
  });
  title(); startWalk();
}
window.G={get S(){return S;},get X(){return X;},get B(){return B;},
  renderTown,openArea,reviveUI,prepUI,startExpedition,nextNode,act,actWord,townEvent,
  title,prologue,save,load:()=>{S=load();},D};
boot();
