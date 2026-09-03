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
# ---- 引くための手がかり(品詞・意味カテゴリ・分野・注記) -----------------
# 名詞が大半なので、品詞だけでは絞れない。分野・表記・字数を手がかりに足す。
POS_JA = [                                   # 上から順に当てる
    ('動詞', ('v1', 'v5', 'v4', 'vs', 'vk', 'vz', 'vn', 'vr', 'vi', 'vt', 'aux-v')),
    ('形容詞', ('adj-i', 'adj-na', 'adj-f', 'adj-t', 'adj-pn', 'adj-ku', 'adj-shiku')),
    ('副詞', ('adv', 'adv-to')),
    ('感動詞', ('int',)),
    ('接続詞', ('conj',)),
    ('助詞', ('prt', 'aux', 'aux-adj')),
    ('代名詞', ('pn',)),
    ('名詞', ('n', 'adj-no', 'n-adv', 'n-t')),
    ('言いまわし', ('exp',)),
    # ここから下は、ほかに何も当たらなかったときだけ。
    # 「山」の第一語義は [n, ctr] で、助数詞を先に見ると名詞でなくなる
    ('接頭・接尾', ('pref', 'suf', 'n-pref', 'n-suf', 'ctr')),
]
FIELD_JA = {
    'food': '食', 'sports': 'スポーツ', 'baseb': 'スポーツ', 'sumo': 'スポーツ',
    'golf': 'スポーツ', 'boxing': 'スポーツ', 'MA': 'スポーツ', 'ski': 'スポーツ',
    'comp': '情報', 'internet': '情報', 'math': '数学', 'physics': '科学',
    'chem': '科学', 'biol': '科学', 'astron': '科学', 'geol': '科学',
    'med': '医学', 'anat': '医学', 'pharm': '医学', 'music': '音楽',
    'Buddh': '宗教', 'Christn': '宗教', 'Shinto': '宗教', 'law': '法律',
    'finc': '経済', 'bus': '経済', 'econ': '経済', 'gramm': 'ことば',
    'ling': 'ことば', 'go': '遊び', 'shogi': '遊び', 'cards': '遊び',
    'mahj': '遊び', 'games': '遊び', 'mil': '軍事', 'print': '印刷',
    'archit': '建築', 'agric': '農業', 'bot': '生物', 'zool': '生物',
    'phil': '思想', 'psych': '思想', 'art': '芸術', 'cloth': '衣',
    'engr': '工学', 'elec': '工学', 'electr': '工学', 'tradem': '商標',
}
NOTE_JA = {'uk': 'かな書き', 'abbr': '略語', 'col': '俗語', 'sl': '俗語',
           'net-sl': 'ネット', 'arch': '古語', 'obs': '古語', 'hist': '歴史',
           'on-mim': '擬音・擬態', 'yoji': '四字熟語', 'hon': '敬語',
           'pol': '丁寧', 'hum': '謙譲', 'derog': 'ののしり', 'chn': '幼児語',
           'fam': 'くだけた', 'form': 'あらたまった', 'dated': '古めかしい',
           'vulg': '下品', 'joc': 'ふざけ', 'proverb': 'ことわざ',
           'id': '慣用句', 'rare': 'まれ'}


def pos_ja(codes):
    """JMdict の品詞コードを、引くための1語にまとめる

    ★ 「名詞 + する」(勉強・旅行・アース)は名詞。JMdict は n と vs を並べて
      付けるので、動詞を先に見ると名詞が消える。用言そのもの(v1/v5…)が
      無ければ名詞として扱う。
    """
    VERB = ('v1', 'v5', 'v4', 'v2', 'vk', 'vz', 'vn', 'vr')
    if not any(c.startswith(VERB) for c in codes):
        # 用言そのものが無い。形容動詞(元気=adj-na,n)は形容詞、
        # 「名詞+する」(勉強=n,vs,vt)は名詞。ここを見ずに vs/vi/vt を
        # 先に拾うと、勉強も元気も動詞になってしまう
        if any(c.startswith('adj') and c != 'adj-no' for c in codes):
            return '形容詞'
        if 'n' in codes:
            return '名詞'
    for name, keys in POS_JA:
        for c in codes:
            if c in keys or any(c.startswith(k) for k in keys if len(k) > 2):
                return name
    return ''


def script_of(w):
    """表記の種類。パズルで引くときの手がかりになる"""
    if any('\u4e00' <= c <= '\u9fff' for c in w):
        return '漢'
    if any('ァ' <= c <= 'ヴ' or c == 'ー' for c in w):
        return 'カ'
    return 'ひ'


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


# ---- 見出しと読みの決めかた -------------------------------------------
# JMdict は 1つの項目に 漢字表記と読みを何通りも並べ、それぞれに印を付ける。
# 「最初に書いてあるもの」を採ると取りちがえる。
#
#   彼の … 漢字表記に rK(まれな漢字表記)、語義に uk(ふつうかなで書く)。
#          JMdict 自身が「漢字では書かない語」と言っているので、見出しは あの。
#   お握り → おにぎり、嚏 → くしゃみ、屹度 → きっと も同じ。
#
# 読みも、印(re_pri)の付いたもの・その漢字表記に対応するもの(re_restr)を選ぶ。
# re_nokanji は「漢字表記の読みではない別語形」なので、読みには使わない。
# 同じ漢字を複数の項目が名のる(人=ひと・じん・にん、彼=かれ・あれ)。
# ファイルに先に出てきたほうを採ると「人(じん)」「彼(あれ)」になる。
# どれが主の読みかを、JMdict が付けている印から決める。
NF = re.compile(r'<(?:ke|re)_pri>nf(\d+)</')
# 主にならない注記。古語・俗語・遠まわし・まれ・略・ふつうかなで書く
DEMOTE = {'arch': 6, 'obs': 6, 'obsc': 5, 'rare': 5, 'dated': 4, 'poet': 4,
          'col': 3, 'euph': 3, 'sl': 3, 'abbr': 2, 'uk': 2, 'derog': 2}
# それだけでは語にならない品詞(接尾辞・接頭辞・助数詞)
NOT_WORD = {'n-suf', 'suf', 'pref', 'n-pref', 'ctr'}


def entry_rank(b, pri):
    """主の読みらしさ。大きいほど主

    ★ nf/news1(新聞での頻度)は使わない。頻度は「空」という書かれた形で
      測るので、から と そら を区別できない。それで順位を付けると
      空→から、下→もと になる。使えるのは ichi1 など人が選んだ印だけ。
    ★ 注記は **第一語義のもの** だけ見る。項目まるごとで見ると、
      「上」の5番目の語義に付いた arch(古語)で うえ が落ちて かみ が主になる。
    """
    v = len({x for x in (set(tag(b, 'ke_pri')) | set(tag(b, 're_pri'))) if x in pri}) * 3
    s1 = re.search(r'<sense>(.*?)</sense>', b, re.S)
    for m in set(re.findall(r'<misc>&(.*?);</misc>', s1.group(1) if s1 else '')):
        v -= DEMOTE.get(m, 0)
    v += min(len(re.findall(r'<sense>', b)), 6)   # 語義の多い読みが その字の本筋
    pos = {x for x in re.findall(r'<pos>&(.*?);</pos>', b)}
    if pos and pos <= NOT_WORD:                 # 接尾辞だけの項目(人=じん・にん)
        v -= 8
    return v


K_ELE = re.compile(r'<k_ele>(.*?)</k_ele>', re.S)
R_ELE = re.compile(r'<r_ele>(.*?)</r_ele>', re.S)
RARE = re.compile(r'&(rK|sK|oK|iK);')          # まれ・検索用・古い・不規則な表記


def head_and_yomi(b, pri):
    """見出しと読みを決める。返り値 (見出し, 読み)"""
    ks = [{'t': (tag(k, 'keb') or [''])[0],
           'rare': bool(RARE.search(k)),
           'pri': bool(set(tag(k, 'ke_pri')) & pri)} for k in K_ELE.findall(b)]
    rs = [{'t': (tag(r, 'reb') or [''])[0],
           'restr': tag(r, 're_restr'),
           'nokanji': '<re_nokanji/>' in r,
           'pri': bool(set(tag(r, 're_pri')) & pri)} for r in R_ELE.findall(b)]
    ks = [k for k in ks if k['t']]
    rs = [r for r in rs if r['t']]
    if not rs:
        return (ks[0]['t'] if ks else ''), ''

    # 漢字表記は、まれな印の付いていないものから。印のあるものを先に
    live = [k for k in ks if not k['rare']]
    kanji = next((k for k in live if k['pri']), live[0] if live else None)

    if kanji is None:
        # 使える漢字表記が無い(彼の・お握り など)。かなを見出しにする
        r = next((x for x in rs if x['pri'] and not x['nokanji']),
                 next((x for x in rs if not x['nokanji']), rs[0]))
        return r['t'], ''

    # その漢字表記の読み。re_restr があれば、それに合うものだけ
    ok = [r for r in rs if not r['nokanji']
          and (not r['restr'] or kanji['t'] in r['restr'])]
    r = next((x for x in ok if x['pri']), ok[0] if ok else rs[0])
    return kanji['t'], r['t']


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

    # 同じ見出しの項目をまとめてから、主の読みを選ぶ
    cand = {}
    for m in ENTRY.finditer(text):
        b = m.group(1)
        if not (set(tag(b, 'ke_pri')) | set(tag(b, 're_pri'))) & PRI:
            continue
        head, yomi = head_and_yomi(b, PRI)
        if head:
            cand.setdefault(head, []).append((entry_rank(b, PRI), yomi, b))

    rows = []
    for head, xs in cand.items():
        xs.sort(key=lambda x: -x[0])
        _, yomi, b = xs[0]
        # ほかの読みも残す(空=から/そら、市場=いちば/しじょう)
        alt = [y for _, y, _ in xs[1:] if y and y != yomi]
        codes = [p.strip('&;') for p in tag(b, 'pos')]
        pos = sorted(set(codes))
        # 品詞は 第一語義のものを主にする(勉強=名詞。動詞は そのあと)
        s1 = re.search(r'<sense>(.*?)</sense>', b, re.S)
        kpos = pos_ja([p.strip('&;') for p in tag(s1.group(1) if s1 else b, 'pos')]) \
            or pos_ja(codes)
        fld = ''
        for f in (x.strip('&;') for x in tag(s1.group(1) if s1 else b, 'field')):
            if f in FIELD_JA:
                fld = FIELD_JA[f]
                break
        notes = []
        for m in (x.strip('&;') for x in tag(s1.group(1) if s1 else b, 'misc')):
            if m in NOTE_JA and NOTE_JA[m] not in notes:
                notes.append(NOTE_JA[m])
        gl = [norm(g) for g in tag(b, 'gloss')]
        # 絵を当てるのは **第一語義** だけ。二番目以降の意味まで手がかりにすると、
        # 「手」に arm(腕)の絵が付くような取りちがえが起きる
        sen = re.findall(r'<sense>(.*?)</sense>', b, re.S)
        g1 = [norm(g) for g in tag(sen[0], 'gloss')] if sen else gl
        en = short_en(gl)
        rows.append({
            'w': head,                              # 見出し
            'yomi': yomi,                           # 読み(見出しがかなのときは空)
            'pos': pos[:3],
            'en': en,                               # 見出しの下に出す言いかえ
            'g1': [g for g in g1 if g],             # 第一語義(絵を当てる手がかり)
            'yomi_alt': list(dict.fromkeys(alt))[:3],   # ほかの読み
            'kpos': kpos,                           # 引くための品詞(1語)
            'field': fld,                           # 分野
            'note': notes[:2],                      # 注記(古語・俗語 など)
            'sc': script_of(head),                  # 漢 / カ / ひ
            'pri': sorted((set(tag(b, 'ke_pri')) | set(tag(b, 're_pri'))) & PRI),
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
