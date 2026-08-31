// 追加語(etymonline由来)の接頭辞・接尾辞を推定して words_add_eo.json に書き戻す。
//
//   node app/infer_affixes.js            検証(既存語150語で精度を測る)
//   node app/infer_affixes.js write      推定結果を words_add_eo.json に反映
//
// 語形だけでは in-1(否定)と in-2(中に)を区別できないので、次の順に判定する:
//   1. 語頭に既存語をそのまま含むならその語の接辞を継承(infanticide ← infant なので in-1)
//   2. etymonline 本文の明示(「see in- (2)」「in- "in, into"」)
//   3. 接辞の語根(affixes.json の root)が、その語の語根パスに含まれるか
//   4. DBでの接辞×語根の共起
//   5. 決められなければ付けない
// 接頭辞は語形一致だけでは付けない(redskin→re- のような誤りを防ぐため、
// 本文明記・語根一致・語幹実在のいずれかを要求する)。
// 既存語150語での検証: 完全一致74% / 誤り17 / 未付与30。
// 番号付き接辞を含む52語では、正しく付与39・番号の取り違え2・未付与11。

const fs=require('fs');const D=require('path').join(__dirname,'..','.cache_wd')+'/';   // etymonline本文のキャッシュ置き場
const A=require('/home/user/haibaratou/app/data/pie/affixes.json');
const W=require('/home/user/haibaratou/app/data/pie/words.json');
const byName=new Map(A.map(a=>[a.name,a]));
const stripNum=n=>n.replace(/\(\d+\)$/,'').replace(/\d+$/,'');   // in-2→in- / -ic(1)→-ic
const DB=W.filter(w=>!w.src&&!/[^a-zA-Z' -]/.test(w.w));
// ---- 語尾/語頭ごとの使われ方をDBから学習 ----
const endStat=new Map(),startStat=new Map();     // 'ing'(3文字) → Map(接尾辞リスト → 件数)
function bump(m,k,v){if(!m.has(k))m.set(k,new Map());const q=m.get(k);q.set(v,(q.get(v)||0)+1);}
for(const w of DB){
  const s=w.w.toLowerCase();
  const suf=(w.suf||'').split(/,\s*/).filter(Boolean).sort().join(', ');
  const pre=(w.pre||'').split(/,\s*/).filter(Boolean).sort().join(', ');
  const pc=(w.pos||'').split('/')[0]||'-';
  for(let L=2;L<=7;L++){ if(s.length>L+1){ bump(endStat,s.slice(-L),suf); bump(endStat,pc+'|'+s.slice(-L),suf); } }
  for(let L=2;L<=7;L++){ if(s.length>L+1){ bump(startStat,s.slice(0,L),pre); bump(startStat,pc+'|'+s.slice(0,L),pre); } }
}
function vote(stat,key,minN,minShare){
  const m=stat.get(key); if(!m)return null;
  let n=0,best=null,bn=0;
  for(const [v,c] of m){n+=c; if(c>bn){bn=c;best=v;}}
  if(n<minN||bn/n<minShare)return null;
  return {val:best,n,share:bn/n};
}
function mentions(text){
  const out=[];
  for(const m of (text||'').matchAll(/see (?:also )?([a-zA-Z]*-[a-zA-Z]*)\s*(?:\((\d)\))?/g))out.push({n:m[1],num:m[2]?+m[2]:null});
  for(const m of (text||'').matchAll(/\b([a-zA-Z]{1,8}-)\s*"([^"]{1,60})"/g))out.push({n:m[1],num:null,gloss:m[2]});
  return out;
}
// 番号付き接辞(in-1/in-2 など)を語根・本文・DB共起で確定する
const rootPair=new Map();
for(const w of DB){(w.pre+','+w.suf).split(/,\s*/).filter(Boolean).forEach(n=>{
  (w.p||[]).forEach(r=>rootPair.set(n+'|'+r,(rootPair.get(n+'|'+r)||0)+1));});}
function disambig(name,{roots,men}){
  const fam=A.filter(a=>stripNum(a.name)===stripNum(name)&&a.t===byName.get(name).t);
  if(fam.length<2)return name;
  const f=stripNum(name);
  const numHit=men.find(m=>stripNum(m.n)===f&&m.num);
  if(numHit){const c=fam.find(c=>c.name.replace(/[^0-9]/g,'')===String(numHit.num));if(c)return c.name;}
  const gl=men.filter(m=>stripNum(m.n)===f).map(m=>m.gloss||'').join(' ').toLowerCase();
  if(gl){
    const c=fam.find(c=>(/\bnot\b|opposite|without|lack/.test(gl)&&/否定|無/.test(c.ja))
                     ||(/\binto\b|\bin\b|\bon\b|upon|toward/.test(gl)&&/中に|上に|向/.test(c.ja)));
    if(c)return c.name;
  }
  const byRoot=fam.filter(c=>c.root&&roots.includes(c.root));
  if(byRoot.length===1)return byRoot[0].name;
  const sc=fam.map(c=>({c,s:roots.reduce((s,r)=>s+(rootPair.get(c.name+'|'+r)||0),0)})).sort((a,b)=>b.s-a.s);
  if(sc[0].s>0&&sc[0].s>sc[1].s)return sc[0].c.name;
  return null;   // 決められないなら付けない
}
// 語幹が単語として存在するか(load+ing → load がDBにある)。接辞を切り出せた傍証になる。
const WORDSET=new Set(DB.map(w=>w.w.toLowerCase()));
// 既存語 → その語の接頭辞(派生語が受け継ぐ)
const BASE_PRE=new Map();
for(const w of DB){
  const k=w.w.toLowerCase();
  BASE_PRE.set(k,w.pre||'');
  if(k.length>=6&&/e$/.test(k)&&!BASE_PRE.has(k.slice(0,-1)))BASE_PRE.set(k.slice(0,-1),w.pre||'');  // improvise→improvis
}
function stemExists(s,affName,t){
  const b=stripNum(affName).replace(/^-/,'').replace(/-$/,'');
  if(!b)return false;
  const stem=t==='suf'?s.slice(0,s.length-b.length):s.slice(b.length);
  if(stem.length<3)return false;
  return WORDSET.has(stem)||WORDSET.has(stem+'e')||WORDSET.has(stem.replace(/([bcdfglmnprstz])\1$/,'$1'))
       ||WORDSET.has(stem+'y')||WORDSET.has(stem.replace(/i$/,'y'));
}
function pick(word,text,roots,pos){
  const s=word.toLowerCase(),men=mentions(text);
  const pc=(pos||'').split('/')[0]||'-';
  const out={pre:'',suf:''};
  let inherited=false;
  for(const [minN,minShare,needStem] of [[6,0.6,false],[4,0.45,true]]){
    if(out.suf)break;
    for(let L=7;L>=2;L--){
      if(s.length<=L+1)continue;
      const v=vote(endStat,pc+'|'+s.slice(-L),Math.max(3,minN-2),minShare)||vote(endStat,s.slice(-L),minN,minShare);
      if(!v)continue;
      if(needStem&&v.val&&!v.val.split(/,\s*/).every(n=>stemExists(s,n,'suf')))continue;
      out.suf=v.val;break;
    }
  }
  for(const [minN,minShare,needStem] of [[6,0.6,false],[4,0.45,true]]){
    if(out.pre)break;
    for(let L=7;L>=2;L--){
      if(s.length<=L+1)continue;
      const v=vote(startStat,pc+'|'+s.slice(0,L),Math.max(3,minN-2),minShare)||vote(startStat,s.slice(0,L),minN,minShare);
      if(!v)continue;
      if(needStem&&v.val&&!v.val.split(/,\s*/).every(n=>stemExists(s,n,'pre')))continue;
      out.pre=v.val;break;
    }
  }
  // 語頭に既存語をそのまま含むなら、その語の接頭辞を受け継ぐ
  // (infanticide は infant を含むので in-1。語頭の綴りだけの多数決より確実)
  {
    let bestBase=null;
    for(let L=Math.min(s.length-2,14);L>=5;L--){
      const cand=BASE_PRE.get(s.slice(0,L));
      if(cand!==undefined){bestBase=cand;break;}   // 空文字(接頭辞なし)も継承する
    }
    if(bestBase!==null){out.pre=bestBase;inherited=true;}
  }

  // 番号付きは語根・本文で確定し直す(決められなければ落とす)
  const fix=list=>list.split(/,\s*/).filter(Boolean).map(n=>{
    const a=byName.get(n); if(!a)return null;
    return /\d/.test(n)?disambig(n,{roots,men}):n;
  }).filter(Boolean).join(', ');
  // 固有名詞(Antaeus など)は語形が偶然一致しやすいので、本文明記がなければ接頭辞を付けない
  if(/^[A-Z]/.test(word)&&!inherited&&out.pre){
    const keep=out.pre.split(/,\s*/).filter(Boolean).filter(n=>men.some(m=>stripNum(m.n)===stripNum(n)));
    out.pre=keep.join(', ');
  }
  if(!inherited)out.pre=fix(out.pre);   // 継承した接頭辞は再判定しない
  out.suf=fix(out.suf);
  // 接頭辞は語形の一致だけでは付けない(redskin→re-、catchpoll→cata- のような誤りを防ぐ)。
  // 本文で言及されている / 接辞の語根が語根パスにある / 残りが語として存在する、のどれかを要求する。
  if(!inherited&&out.pre){
    out.pre=out.pre.split(/,\s*/).filter(Boolean).filter(n=>{
      const a=byName.get(n); if(!a)return false;
      if(men.some(m=>stripNum(m.n)===stripNum(n)))return true;
      if(a.root&&roots.includes(a.root))return true;
      return stemExists(s,n,'pre');
    }).join(', ');
  }

  // 本文で「see in- (1)」「im- "否定"」のように明示された接辞は取りこぼさない
  for(const m of men){
    const f=stripNum(m.n);
    const fam=A.filter(a=>stripNum(a.name)===f);
    if(!fam.length)continue;
    const t=fam[0].t;
    const cur=(t==='pre'?out.pre:out.suf).split(/,\s*/).filter(Boolean);
    if(cur.some(n=>stripNum(n)===f))continue;
    const b=f.replace(/-$/,'').replace(/^-/,'');
    if(t==='pre'&&!s.startsWith(b)&&!m.num)continue;   // 同化形は明示番号があるときだけ
    if(t==='suf'&&!s.endsWith(b))continue;             // 語尾が合わない結合形は足さない
    const name=fam.length>1?disambig(fam[0].name,{roots,men}):fam[0].name;
    if(!name)continue;
    cur.push(name);
    if(t==='pre')out.pre=cur.slice(0,2).join(', ');else out.suf=cur.slice(0,2).join(', ');
  }

  // ex- と extra- のように一方が他方の一部になる接頭辞は、長いほうだけ残す
  const pl=out.pre.split(/,\s*/).filter(Boolean);
  if(pl.length>1){
    const keep=pl.filter(n=>{const b=stripNum(n).replace(/-$/,'');
      return !pl.some(o=>{const ob=stripNum(o).replace(/-$/,'');return ob!==b&&ob.startsWith(b);});});
    out.pre=(keep.length?keep:pl).join(', ');
  }
  return out;
}
module.exports={pick};
if(require.main===module){
  const val=require(D+'affix_val.json');
  let tot=0,exact=0,miss=0,extra=0;const bad=[];
  for(const wd of val){
    const f=D+'wd/'+wd.replace(/[^a-z0-9]/gi,'_')+'.json';
    if(!fs.existsSync(f))continue;
    const j=JSON.parse(fs.readFileSync(f,'utf8'));if(!j.ok)continue;
    const db=W.find(x=>x.w===wd);if(!db)continue;
    const got=pick(wd,(j.ents||[]).map(e=>e.text).join(' '),db.p||[],db.pos);
    const gset=new Set([...got.pre.split(/,\s*/),...got.suf.split(/,\s*/)].filter(Boolean));
    const eset=new Set([...(db.pre||'').split(/,\s*/),...(db.suf||'').split(/,\s*/)].filter(Boolean));
    tot++;
    const m=[...eset].filter(x=>!gset.has(x)),e=[...gset].filter(x=>!eset.has(x));
    if(!m.length&&!e.length)exact++;else{miss+=m.length;extra+=e.length;
      if(bad.length<18)bad.push(`${wd}: 推定[${[...gset].join(', ')}] 正解[${[...eset].join(', ')}]`);}
  }
  console.log(`検証 ${tot}語 | 完全一致 ${exact} (${Math.round(exact/tot*100)}%) | 取りこぼし ${miss} | 誤り ${extra}`);
  bad.forEach(b=>console.log('  ',b));
}
