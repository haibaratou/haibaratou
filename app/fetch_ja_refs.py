#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日本語の辞書の記述を、語ごとに控える(コトバンク)

★ 英語側と同じ規律で作る。
  ・辞書の記述は **そのまま** 控える。要約も刈りこみもしない
  ・語義や語源をまとめるのは、資料を読む別の工程
  ・辞書ごとに別の欄に置き、どの辞書の記述かを必ず残す

出どころ:
    kotobank … デジタル大辞泉 / 精選版 日本国語大辞典

  goo辞書はこの環境から接続できない。同じデジタル大辞泉を収録している
  コトバンクを使う。Weblio も試したが、国語辞典としては デジタル大辞泉 が
  重なるだけで、固有のものは実用日本語表現辞典しか無かった(1,195語中526語)。
  同じ辞書を二度取るだけなので、コトバンクに一本化した。
  大辞林は両サイトとも配信していない(0件)。

取りかた:
  ・1語ずつ、必ず逐次。間をあけて取る
  ・見出しで国語辞典が出てこないときは、別表記でもう一度だけ引く
    (おでん→御田、あそこ→彼処、Ｔシャツ→Tシャツ。かなの見出しだと
     コトバンクが百科事典しか置いていないことがある)
  ・取れたものはディスクに残し、二度は聞きにいかない
  ・弾かれたら(403/429)その場で止める。続きは同じコマンドで再開できる

つかいかた:
    python3 app/fetch_ja_refs.py --words data/ja/ja_words.txt --src kotobank
    python3 app/fetch_ja_refs.py --words data/ja/ja_words.txt --src weblio
    python3 app/fetch_ja_refs.py --words ... --reparse    # 控えから読み直すだけ
"""
import argparse, hashlib, json, os, random, re, subprocess, sys, time
from pathlib import Path

BASE = Path(__file__).resolve().parent
JA = BASE / 'data' / 'ja'
CACHE = JA / 'cache'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')
# 2万語あるので、礼儀を保てる範囲で詰める。弾かれたら(403/429)その場で止まる
WAIT = {'kotobank': (2.5, 1.0), 'weblio': (2.5, 1.0)}


def key_of(word):
    """見出しは漢字やかなを含む。ファイル名にできる形にする"""
    h = hashlib.sha1(word.encode('utf-8')).hexdigest()[:12]
    safe = re.sub(r'[^A-Za-z0-9]+', '', word)[:16]
    return f'{safe}_{h}' if safe else h


def get(url, tries=3):
    for k in range(tries):
        r = subprocess.run(['curl', '-sSL', '--compressed', '-m', '40',
                            '-A', UA, '-w', '\n%{http_code}', url],
                           capture_output=True)
        out = r.stdout.decode('utf-8', 'ignore')
        body, _, code = out.rpartition('\n')
        code = code.strip()
        if code == '200' and body.strip():
            return body
        if code in ('403', '429'):
            return None                       # 遮断。すぐ止める
        if code == '404':
            return ''
        time.sleep(2 ** k)
    return ''


def strip_tags(t):
    t = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', t, flags=re.S | re.I)
    t = re.sub(r'<br\s*/?>', '\n', t, flags=re.I)
    t = re.sub(r'</(p|div|li|section|h\d)>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]+>', '', t)
    import html as _h
    t = _h.unescape(t)
    t = re.sub(r'[ \t　]+', ' ', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


# 採る辞書を絞る。両サイトは何百もの専門辞典を並べていて、そのまま取ると
# ウィキペディア・短編小説作品名辞典・隠語大辞典・がん用語辞書まで入ってしまう。
# 集めるのは **国語辞典** の記述だけ。
KEEP = (
    'デジタル大辞泉',          # 小学館。goo辞書もこれを配信している
    '精選版 日本国語大辞典',    # 小学館。語誌・古い用例が厚い
    '大辞林',                 # 三省堂
    '実用日本語表現辞典',       # 現代語の言いまわし
)


def keep_dict(name):
    n = (name or '').strip()
    if not n:
        return False
    if 'プラス' in n:          # デジタル大辞泉プラス は固有名詞の事典
        return False
    return any(k in n for k in KEEP)



# ---- コトバンク ----
def kotobank_url(word):
    import urllib.parse
    return 'https://kotobank.jp/word/' + urllib.parse.quote(word)


KB_BLOCK = re.compile(
    r'<h2[^>]*>(.*?)</h2>(.*?)(?=<h2[^>]*>|<footer|</main)', re.S)


def kotobank(word, body):
    """辞書ごとに 見出し・本文を そのまま控える"""
    out = []
    for m in KB_BLOCK.finditer(body):
        name = strip_tags(m.group(1)).split('\n')[0].strip()
        if not keep_dict(name):
            continue
        seg = m.group(2)
        heads = [strip_tags(h).strip()
                 for h in re.findall(r'<h3[^>]*>(.*?)</h3>', seg, re.S)]
        texts = [strip_tags(d).strip()
                 for d in re.findall(
                     r'<section[^>]*class="description"[^>]*>(.*?)</section>',
                     seg, re.S)]
        if not texts:
            continue
        for i, t in enumerate(texts):
            if not t:
                continue
            out.append({'d': name,                       # 辞書名
                        'h': heads[i] if i < len(heads) else '',
                        'x': t})                         # 本文(そのまま)
    return json.dumps(out, ensure_ascii=False) if out else ''


# ---- Weblio 国語 ----
def weblio_url(word):
    import urllib.parse
    return 'https://www.weblio.jp/content/' + urllib.parse.quote(word)


# 辞書名は <div class="pbarT">、本文は <div class="kiji">、見出しは class=midashigo
WB_NAME = re.compile(r'<div class="pbarT">(.*?)</div>', re.S)
WB_BODY = re.compile(r'<div class="kiji">(.*?)(?=<div class="pbarT"|<div id="footer"'
                     r'|<div class="footer)', re.S)
WB_HEAD = re.compile(r'<h2[^>]*class=midashigo[^>]*>(.*?)</h2>', re.S)


def weblio(word, body):
    """辞書ごとに 見出し・本文を そのまま控える。

    辞書名(pbarT)と本文(kiji)を「何番目か」で対応づけると、片方だけ在る
    ところでずれて、ウィキペディアの本文が国語辞典の名で入ってしまう。
    並び順で対にする ── ある辞書名のうしろ、次の辞書名までが その本文。
    """
    marks = [(m.start(), 'name', strip_tags(m.group(1)).strip())
             for m in WB_NAME.finditer(body)]
    marks += [(m.start(), 'body', m.group(1)) for m in WB_BODY.finditer(body)]
    marks.sort()
    out, cur = [], ''
    for _, kind, val in marks:
        if kind == 'name':
            cur = val
            continue
        if not keep_dict(cur):
            continue
        heads = [strip_tags(h).strip() for h in WB_HEAD.findall(val)]
        text = strip_tags(WB_HEAD.sub('', val)).strip()
        if text:
            out.append({'d': cur, 'h': heads[0] if heads else '', 'x': text})
    return json.dumps(out, ensure_ascii=False) if out else ''


SRC = {'kotobank': (kotobank_url, kotobank), 'weblio': (weblio_url, weblio)}


def run(words, srcs, reparse=False):
    for src in srcs:
        mk_url, parse = SRC[src]
        d = CACHE / src
        d.mkdir(parents=True, exist_ok=True)
        base, jitter = WAIT[src]
        fp_json = JA / f'ja_refs_{src}.json'
        # 同じ出どころを2本走らせると 書き出しが上書きし合う
        lock = d / '.running'
        if lock.exists() and not reparse:
            try:
                os.kill(int(lock.read_text()), 0)
                print(f'  [{src}] もう1本動いている。二重には走らせない', file=sys.stderr)
                continue
            except (ValueError, ProcessLookupError, PermissionError, OSError):
                pass
        if not reparse:
            lock.write_text(str(os.getpid()))

        def dump():
            out = {}
            # 読み直し(--reparse)のときは 作り直す。合成すると、
            # 絞り込む前に採ってしまった記述が残ってしまう
            if fp_json.exists() and not reparse:
                try:
                    out = json.loads(fp_json.read_text(encoding='utf-8'))
                except json.JSONDecodeError:
                    out = {}
            for f in sorted(d.glob('*.raw')):
                w = (f.with_suffix('.w').read_text(encoding='utf-8')
                     if f.with_suffix('.w').exists() else f.stem)
                t = parse(w, f.read_text(encoding='utf-8'))
                if t and t.strip():
                    out[w] = t
            fp_json.write_text(json.dumps(out, ensure_ascii=False, indent=1),
                               encoding='utf-8')
            return out

        done = set()
        if fp_json.exists():
            try:
                done = set(json.loads(fp_json.read_text(encoding='utf-8')))
            except json.JSONDecodeError:
                done = set()
        n_new = 0
        stop = False
        for i, (w, spells) in enumerate(words, 1):
            if w in done or reparse:
                continue
            got = False
            for sp in [w] + list(spells):
                ck = key_of(sp)
                fp = d / (ck + '.raw')
                if fp.exists() and fp.stat().st_size == 0:
                    fp.unlink()                # 空の控えは「取れなかった」もの
                if fp.exists():
                    # すでに控えがある。国語辞典が入っていれば それで済ませ、
                    # 入っていなければ次の表記を試す
                    if parse(w, fp.read_text(encoding='utf-8')):
                        # 前のパスで別の見出しとして取った控えのことがある
                        # (彼処 の控えが 彼処 に紐づいたまま。いまの見出しは あそこ)。
                        # 紐づけ先を いまの見出しに直す
                        (d / (ck + '.w')).write_text(w, encoding='utf-8')
                        got = True
                        break
                    continue
                body = get(mk_url(sp))
                if body is None:
                    print(f'  [{src}] {sp} で弾かれた。ここで止める'
                          f'(この回に取れたのは {n_new}語)', file=sys.stderr)
                    stop = True
                    break
                fp.write_text(body, encoding='utf-8')
                (d / (ck + '.w')).write_text(w, encoding='utf-8')   # 見出しに紐づける
                n_new += 1
                time.sleep(base + random.uniform(0, jitter))
                if parse(w, body):
                    got = True
                    break
            if stop:
                break
            mark = '' if got else '  (国語辞典なし)'
            print(f'  [{src} {i}/{len(words)}] {w}{mark}', file=sys.stderr)
            if n_new and n_new % 25 == 0:
                dump()
        out = dump()
        lock.unlink(missing_ok=True)
        print(f'{src}: {len(out)}語 → data/ja/ja_refs_{src}.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--words', required=True)
    ap.add_argument('--src', default='kotobank')
    ap.add_argument('--reparse', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    # 1行 = 見出し[TAB]別表記[TAB]別表記…
    words, seen = [], set()
    for line in Path(a.words).read_text(encoding='utf-8').splitlines():
        parts = [x.strip() for x in line.split('\t') if x.strip()]
        if not parts or parts[0] in seen:
            continue
        seen.add(parts[0])
        words.append((parts[0], parts[1:]))
    if a.limit:
        words = words[:a.limit]
    run(words, [s for s in a.src.split(',') if s in SRC], a.reparse)


if __name__ == '__main__':
    main()
