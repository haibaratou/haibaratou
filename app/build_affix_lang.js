// 接辞ごとの語派を求めて data/pie/affix_lang.csv を作る。
//
//   node app/build_affix_lang.js
//
// 優先順位: ①手当て(data/pie/affix_lang_fix.json) ②接辞の定義文 ③etymonline。
// 用例(その接辞を使う語の語派)の多数決は当てにならないので使わない
// (-ly はラテン語系の語幹に付くことが多いだけで、接辞自体はゲルマン語)。
// etymonline の判定は「借用チェーンで最後に出てくる言語」= どこまで遡れるかで見る
// (-ism はフランス語→ラテン語→ギリシャ語なのでギリシャ語)。

const fs=require('fs');
const A=require('./data/pie/affixes.json');
const CUT=/source also of|cognate with|\bakin to\b|related to|compare\b|It might also be|is cognate/i;
const SEQ=[['Gr',/\bGreek\b/],['L',/\bLatin\b|\bFrench\b|\bItalian\b|\bSpanish\b|Anglo-French/],
 ['G',/Old English|Proto-Germanic|Old Norse|Middle Dutch|\bDutch\b|\bGerman\b|\bGothic\b|Old Saxon|Old Frisian|Middle English|\bEnglish\b/],
 ['Sa',/\bSanskrit\b/],['Ir',/\bPersian\b|\bAvestan\b/],['Ce',/\bCeltic\b|\bIrish\b|\bGaelic\b|\bWelsh\b/],['Sl',/\bRussian\b|\bSlavic\b/]];
function deepG(text){
  const m=text.search(CUT);const chain=m>0?text.slice(0,m):text;
  let best=null;
  for(const [g,re] of SEQ){let last=-1,mm;const r=new RegExp(re.source,'g');
    while((mm=r.exec(chain)))last=mm.index;
    if(last>=0&&(!best||last>best.i))best={g,i:last};}
  return best?best.g:'';
}
const CACHE=require('path').join(__dirname,'..','.cache_wd')+'/';   // etymonline本文のキャッシュ
const strip=n=>n.replace(/\(\d+\)$/,'').replace(/\d+$/,'');
// 優先順位: 手当て > 接辞の定義文 > etymonline。用例の多数決は当てにならないので使わない。
const FIX=require('./data/pie/affix_lang_fix.json');   // 使用回数の多い接辞の手当て
const PAT=[['Gr',/ギリシャ/],['L',/ラテン|フランス|イタリア|スペイン/],
 ['G',/ゲルマン|古英語|古期英語|中期英語|英語|ドイツ|オランダ|古ノルド|北欧/],
 ['Sa',/サンスクリット/],['Ir',/ペルシャ/],['Ce',/ケルト|アイルランド|ウェールズ/],['Sl',/ロシア|スラヴ/]];
const out=A.map(a=>{
  if(FIX[a.name]!==undefined)return {name:a.name,g:FIX[a.name],src:'手当て',cnt:a.cnt||0};
  const d=PAT.find(([g,re])=>re.test(a.def||''));
  if(d)return {name:a.name,g:d[0],src:'定義文',cnt:a.cnt||0};
  for(const cand of [a.name,strip(a.name)]){
    const f=CACHE+cand.replace(/[^a-z0-9]/gi,'_')+'.json';
    if(!fs.existsSync(f))continue;
    const j=JSON.parse(fs.readFileSync(f,'utf8'));if(!j.ok)continue;
    const num=(a.name.match(/\((\d)\)$|(\d)$/)||[])[1];
    const ents=num?j.ents.filter(e=>(e.pos||'').includes('('+num+')')):j.ents;
    const g=deepG((ents.length?ents:j.ents).map(e=>e.text).join(' '));
    if(g)return {name:a.name,g,src:'etymonline',cnt:a.cnt||0};
    break;
  }
  return {name:a.name,g:'',src:'',cnt:a.cnt||0};
});
const rows=out.filter(o=>o.g);
const q=s=>/[,"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
fs.writeFileSync(__dirname+'/data/pie/affix_lang.csv','name,g,src\n'+rows.map(r=>[r.name,r.g,r.src].map(q).join(',')).join('\n')+'\n');
const c={};out.forEach(o=>c[o.g||'空']=(c[o.g||'空']||0)+1);
console.log('接辞',out.length,'| 語派あり',rows.length,'|',JSON.stringify(c));
const src={};rows.forEach(o=>src[o.src]=(src[o.src]||0)+1);console.log('判定元',JSON.stringify(src));
console.log(['-al(1)','-al(2)','-al(3)','-ness','-ment','-ism','-ic(1)','-ly(1)','-or(2)','-ive','-ation'].map(n=>{const o=out.find(x=>x.name===n);return n+'='+(o?o.g+'('+o.src+')':'?');}).join(' '));
