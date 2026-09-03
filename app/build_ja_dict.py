#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日本語辞書を組む(見出し + 読み + 品詞 + 絵 + 各辞書の語義)

辞書の記述は **そのまま** 置く。要約も刈りこみもしない。
どの辞書の記述かを必ず残す。まとめてオリジナルの文にするのは別の工程。

    python3 app/build_ja_dict.py
    → data/ja/ja_dict.json
"""
import json, re
from pathlib import Path

BASE = Path(__file__).resolve().parent
JA = BASE / 'data' / 'ja'
# 語義の辞書として見せるもの。専門辞典や人名辞典はうしろに回す
MAIN = ('デジタル大辞泉', '精選版 日本国語大辞典', '大辞林', '実用日本語表現辞典',
        '和英辞典', '百科事典')


def load(name):
    fp = JA / name
    return json.loads(fp.read_text(encoding='utf-8')) if fp.exists() else {}


def entries(raw):
    try:
        v = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    return v if isinstance(v, list) else []


# 五十音の行で分ける。1文字ずつだと細かすぎ、まとめすぎると重い
ROWS = {'あ': 'あいうえおぁぃぅぇぉ', 'か': 'かきくけこがぎぐげご',
        'さ': 'さしすせそざじずぜぞ', 'た': 'たちつてとだぢづでどっ',
        'な': 'なにぬねの', 'は': 'はひふへほばびぶべぼぱぴぷぺぽ',
        'ま': 'まみむめも', 'や': 'やゆよゃゅょ', 'ら': 'らりるれろ',
        'わ': 'わをんゎ'}
CHAR2ROW = {c: r for r, cs in ROWS.items() for c in cs}


def kana_row(c):
    import unicodedata
    if not c:
        return '_'
    c = unicodedata.normalize('NFKC', c)
    # カタカナはひらがなに寄せる
    if 'ァ' <= c <= 'ヴ':
        c = chr(ord(c) - 0x60)
    return CHAR2ROW.get(c, '_')


# 読みの並び順は デジタル大辞泉 の見出しの順を正本にする。
#   山 → やま【山】/ さん【山】…  大辞泉が代表的な読みから並べている。
# JMdict の印だけでは 空(から/そら)や 角(かく/かど)の主従が決まらない。
HEAD_YOMI = re.compile(r'^([ぁ-んァ-ヴー・‐\u30fb]+)【(.+?)】')
DEL = str.maketrans('', '', '▽×‐・〈〉《》 ')


def yomi_of_head(h, w):
    """コトバンクの見出し 'やま【山】' から読みを取る。字が違うものは採らない"""
    m = HEAD_YOMI.match((h or '').strip())
    if not m or '［漢字項目］' in (h or ''):
        return ''                      # 漢字項目は 字の解説。語の読みではない
    if w not in m.group(2).translate(DEL).split('／'):
        return ''
    y = m.group(1).translate(DEL)
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヴ' else c for c in y)


def yomi_order(srcs, w, fallback):
    """大辞泉の並び順で読みを返す。無ければ JMdict の順"""
    seen = []
    for e in srcs:
        if 'デジタル大辞泉' not in e['dict']:
            continue
        y = yomi_of_head(e['head'], w)
        if y and y not in seen:
            seen.append(y)
    if not seen:
        return fallback
    # 大辞泉に出てこなかった読みは うしろに足す(落とさない)
    return seen + [y for y in fallback if y not in seen]


def rank(name):
    """国語辞典を先に、専門辞典をうしろに"""
    for i, m in enumerate(MAIN):
        if m in name:
            return i
    return len(MAIN)


def main():
    seed = json.loads((JA / 'ja_seed.json').read_text(encoding='utf-8'))
    # コトバンク一本。Weblio は デジタル大辞泉 が重なるだけだった
    kb = load('ja_refs_kotobank.json')
    out, n_def = [], 0
    for r in seed:
        w = r['w']
        srcs = []
        for store, tag in ((kb, 'コトバンク'),):
            for e in entries(store.get(w, '')):
                if not (e.get('x') or '').strip():
                    continue
                srcs.append({'dict': e.get('d', ''), 'via': tag,
                             'head': e.get('h', ''), 'text': e['x']})
        srcs.sort(key=lambda e: rank(e['dict']))
        if srcs:
            n_def += 1
        ys = yomi_order(srcs, w, [y for y in [r['yomi']] + r.get('yomi_alt', []) if y])
        out.append({
            'w': w, 'yomi': ys[0] if ys else '', 'yomi_all': ys[:4],
            'pos': r['pos'], 'pic': r['pic'],
            'en': r['en'],
            'ja': '',      # 語義(まとめた一文)。資料を読む工程で書く
            'gen': '',     # 語源。同上
            'src': srcs,   # 辞書の記述そのまま
        })
    (JA / 'ja_dict.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')

    # 画面用に2つに分ける。辞書の記述は語が増えるほど重くなるので、
    # 起動時に読むのは索引だけにして、本文は開いた語のぶんだけ取りにいく。
    idx = [[x['w'], '・'.join(x['yomi_all']), '/'.join(x['pos'][:2]), x['pic'],
            '; '.join(x['en'][:2]), 1 if x['src'] else 0] for x in out]
    (JA / 'ja_index.json').write_text(
        json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    shard = {}
    for x in out:
        if not x['src']:
            continue
        c = (x['yomi'] or x['w'])[:1]
        shard.setdefault(kana_row(c), {})[x['w']] = [
            [s['dict'], s['via'], s['head'], s['text']] for s in x['src']]
    d = JA / 'ja_det'
    d.mkdir(exist_ok=True)
    for f in d.glob('*.json'):
        f.unlink()
    for c, obj in shard.items():
        (d / f'{c}.json').write_text(
            json.dumps(obj, ensure_ascii=False, separators=(',', ':')),
            encoding='utf-8')
    print(f'  索引 ja_index.json / 本文 ja_det/*.json {len(shard)}分割')
    print(f'日本語辞書 {len(out):,}語 → data/ja/ja_dict.json')
    print(f'  辞書の語義が入った語 {n_def:,}語 / まだの語 {len(out)-n_def:,}語')
    print(f'  絵が付いた語 {sum(1 for x in out if x["pic"]):,}語')


if __name__ == '__main__':
    main()
