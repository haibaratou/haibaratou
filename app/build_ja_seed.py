#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日本語辞書の見出し語(基本語彙)を作る

出どころは JMdict(EDRDG)。1991年から続く日本語辞書データで、
「よく使う語」の印(ichi1 / news1 / spec1 / gai1)が付いている。
その印のある語を基本語彙として見出しにする。

ここで作るのは **見出しの一覧だけ**。語義や語源は goo辞書・Weblio国語から
そのまま控える(app/fetch_ja_refs.py)。まとめるのは資料を読む別の工程。

英単語データベースに絵のある語は、和訳を手がかりに結びつけて流用する。

    python3 app/build_ja_seed.py --jmdict <JMdict_e.gz>
"""
import argparse, gzip, json, re, unicodedata
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUT = BASE / 'data' / 'ja'
PRI = {'ichi1', 'news1', 'spec1', 'gai1'}      # よく使う語の印
ENTRY = re.compile(r'<entry>(.*?)</entry>', re.S)
KANA = re.compile(r'^[ぁ-んァ-ヴー]+$')


# 見出しの下に出す英語の言いかえ。
#
# ★ 文を途中で切ってはいけない。JMdict は 1語に複数の英訳を並べているので、
#   「長いものを刈りこむ」のではなく「短いものを選ぶ」。どれも長いときは、
#   いちばん短いものを **そのまま** 使う。切り詰めない。
#   (画面が狭いときは CSS の側で … と省く。データは欠けさせない)
def unparen(t):
    """括弧の添え書きを外す。入れ子(Canis (lupus) familiaris)も外す"""
    out, depth = [], 0
    for ch in t or '':
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return ''.join(out)


def norm(g):
    return re.sub(r'\s+', ' ', (g or '')).strip(' ,;')


def short_en(glosses, n=2, cap=44):
    """短い言いかえを2つまで。選ぶだけで、文は切らない"""
    # 括弧の注記は添え書きなので、言いかえの行からは外す。
    #   猫 → "cat (esp. the domestic cat, Felis catus)" は "cat" と出す。
    # これは文を切るのではなく、括弧のなかの補足を出さないということ。
    # もとの記述は 'gl' と辞書の欄にそのまま残る。
    pool = []
    for g in glosses:
        g = norm(unparen(norm(g)))
        if g and g not in pool:
            pool.append(g)
    if not pool:
        return []
    out = []
    for g in pool:
        if len('; '.join(out + [g])) > cap and out:
            break
        out.append(g)
        if len(out) >= n:
            break
    if not out:
        # 一つめが長い。刈りこまず、そのまま出す。短い別の語義に
        # すり替えると、主でない意味が見出しに出てしまう
        out = [pool[0]]
    return out


def tag(block, name):
    return re.findall(rf'<{name}>(.*?)</{name}>', block, re.S)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jmdict', required=True)
    ap.add_argument('--images', default='', help='絵のあるフォルダ(assets/word)')
    ap.add_argument('--words', default='', help='英単語DBの words.json')
    a = ap.parse_args()
    text = gzip.open(a.jmdict, 'rt', encoding='utf-8').read()

    # 英単語DBの和訳 → 絵のある英単語 の対応
    pic, imgs = {}, set()
    if a.images and a.words:
        imgs = {p.stem.lower() for p in Path(a.images).glob('*.png')}
        for x in json.loads(Path(a.words).read_text(encoding='utf-8')):
            if x['w'].lower() in imgs:
                for g in (x.get('ja') or '').split('、'):
                    g = g.strip()
                    if g:
                        pic.setdefault(g, x['w'])

    rows, seen = [], set()
    for m in ENTRY.finditer(text):
        b = m.group(1)
        pris = set(tag(b, 'ke_pri')) | set(tag(b, 're_pri'))
        if not (pris & PRI):
            continue
        kanji = tag(b, 'keb')
        kana = tag(b, 'reb')
        head = (kanji[0] if kanji else (kana[0] if kana else ''))
        if not head or head in seen:
            continue
        seen.add(head)
        pos = sorted({p.strip('&;') for p in tag(b, 'pos')})
        gl = [norm(g) for g in tag(b, 'gloss')]
        # 絵を当てるのは **第一語義** だけ。二番目以降の意味まで手がかりにすると、
        # 「手」に arm(腕)の絵が付くような取りちがえが起きる
        sen = re.findall(r'<sense>(.*?)</sense>', b, re.S)
        g1 = [norm(g) for g in tag(sen[0], 'gloss')] if sen else gl
        en = short_en(gl)
        rows.append({
            'w': head,                              # 見出し
            'yomi': kana[0] if kana else '',        # 読み
            'pos': pos[:3],
            'en': en,                               # 見出しの下に出す言いかえ
            'g1': [g for g in g1 if g],             # 第一語義(絵を当てる手がかり)
            'pri': sorted(pris & PRI),
            'pic': '',                              # 流用できる絵(あとで当てる)
        })
    # 絵の当てかたは2通り。どちらも「同じ意味の英単語に絵がある」ことを使う
    #   1. JMdict の英訳が そのまま絵の名まえ (お金 → money.png)
    #   2. 英単語データベースの和訳が この見出しと一致 (腹部 → abdomen.png)
    for r in rows:
        # 第一語義の いちばん目 の訳だけを見る。二番目まで見にいくと
        # 「手(hand; arm)」に arm の絵が付いてしまう
        for cand in (r['g1'][:1] or ['']):
            c = norm(unparen(cand)).lower()
            if c in imgs:
                r['pic'] = c
        if not r['pic'] and r['w'] in pic:
            r['pic'] = pic[r['w']]
    # 絵が付く語を、和訳の側からも当てる
    n_pic = sum(1 for r in rows if r['pic'])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'ja_seed.json').write_text(
        json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf-8')
    (OUT / 'ja_words.txt').write_text(
        '\n'.join(r['w'] for r in rows), encoding='utf-8')
    print(f'基本語彙 {len(rows):,}語 → data/ja/ja_seed.json')
    print(f'  そのうち 絵が流用できる語 {n_pic:,}語')


if __name__ == '__main__':
    main()
