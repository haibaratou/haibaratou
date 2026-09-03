# データの地図 ── どれが母艦で、どれが派生か

> 動かしかた(リポジトリ・push・スクリプトの順番・日本語辞書)は
> `README-AIのための取扱説明書.md` にある。ここはデータの決まりだけ。

ゲームのデータと辞書のデータが同じ棚に混ざっていて、どれを手で直してよくて
どれが機械の作りものなのか見分けがつかなくなっていた。ここで線を引く。

## ひとつだけのルール

- **母艦(source)** … 手で書いたもの・買ったもの・取ってきたもの。**消したら戻らない。**
  語源データベースの生データ。**非公開**。
- **派生(build)** … 母艦からスクリプトが作るもの。**消しても作り直せる。**
  エティモペディア(公開サイト)も、ゲームの各データも、ぜんぶこちら。

> 派生を手で直してはいけない。次に作り直したとき、その手直しは消える。
> 直したいことがあったら、母艦か、母艦を作るスクリプトのほうを直す。

```
   docs/WildWordopia PIE.xlsx ─┐
   手当ての CSV 群 ────────────┤
   取ってきたもの(etymonline / Wiktionary / Ngram)─┤
                                                   ↓  build_pie_data.py ほか
                                            【母艦】語源データベース
                                                   ↓
                    ┌──────────────────┴──────────────────┐
                    ↓                                      ↓
        エティモペディア(公開サイト)                 ゲーム各種
        app/data/*.csv                          deck / fusion / town / word_block …
```

## いまある物の棚卸し

### 母艦 ①辞書の本体(6.6MB)
`words.json`(18,878語) `roots.json`(1,436語根) `affixes.json`
`details_brief.json` `det/`(27ファイル 26MB) `eo/`(27ファイル 11MB)

- `det/<初文字>.json` … 語ID → [語源解説, Merriam-Webster, Wiktionary, 見出し,
  発音記号, カナ, 音節, 英辞郎, Weblio]。**元は買った辞書(ハイパー英語語源辞書)の列**。
- `eo/<初文字>.json` … etymonline の記述。**proprietary。公開物に混ぜない。**

### 母艦 ②手当て(2.9MB)── いちばん失いたくない資産
`word_blurb.csv`(1.9MB ひとこと語源) `word_tag.csv`(375KB) `word_para.csv`(210KB)
`word_kana.csv` `word_ja_fix.csv` `word_lang_fix.csv` `valence.csv` `root_rank.csv`
`root_eo.csv` `affix_lang.csv` `word_sentence.csv` ほか `*_fix.csv` `*_override.csv`

人が判断して書いた列。機械で作り直せない。**これがいちばんの資産。**

### 母艦 ③足したもの
`words_add_eo.json`(1,419語 etymonline から補完)
`words_add_nonpie.json`(語根に紐づかない語。ここから増やす)
`nopie.json`(16,662語 ── **DBに無い語の一覧。レア度と語派つき。増やす種はもうここにある**)

### 母艦 ④取ってきたもの(消しても取り直せる)
`ngram_freq.json` `eo_slugs.json` `cache_kaikki/` `word_lang_review.json`
`words_add_eo_report.json`

### 派生 ── ゲーム用(14MB)。ぜんぶ作り直せる

| ファイル | 作るもの | つかう画面 |
|---|---|---|
| `deck.json` | `build_deck.py` | カード |
| `etymon.json` | `build_etymon_data.py` | エティモンずかん |
| `fusion.json` | `build_fusion.py` | ことば鍛成館 |
| `game_cards.json` | `build_game_cards.py` | タグ判定 |
| `kingdom.json` | `build_kingdom.py` | キングダム型 |
| `lesson.json` | `build_lesson.py` | レッスン |
| `lookup.json` | `build_lookup.py` | 引き表 |
| `puzzle.json` | `build_puzzle_data.py` | 一筆書きパズル |
| `run.json` | `build_run_data.py` | エティモラン |
| `scribble.json` | `build_scribble.py` | 遠征の試練 |
| `swipe.json` | `build_swipe.py` | スワイプ式 |
| `town.json` | `build_town_data.py` | ことばの町 |
| `voice.json` | `build_voice.py` | 語根キャラのセリフ |
| `word_block.json` | `build_word_block_cards.py` | スラッシュ / ブロック戦 |
| `word_stats.json` | `build_word_stats.py` | ゲームの効果値 |
| `enemies.json` | `build_battle_enemies.py` | 戦闘の敵 |

### 派生 ── 公開サイト(エティモペディア)
`app/data/*.csv`(ui / roots / morphs / words / lexicon / featured / submissions)
← `build_etymopedia_from_pie.py` が母艦から作る。
そのあと `build_etymopedia_emb.py` が `etymopedia.html` の埋め込みCSVを作り直す。

**公開してよいのはここだけ。** 母艦の `det/` `eo/` は買った辞書と etymonline の
記述そのものなので、サイトにもゲームにも中身を出さない(リンクは出してよい)。

## これからの置きかた(提案)

```
app/data/
  source/                 母艦。手で直すのはここだけ。非公開
    dict/                 words.json roots.json affixes.json details_brief.json det/ eo/
    hand/                 *_fix.csv *_override.csv word_blurb.csv word_tag.csv …
    add/                  words_add_eo.json words_add_nonpie.json nopie.json
    cache/                ngram_freq.json eo_slugs.json cache_kaikki/ …
  build/                  派生。手で直さない
    etymopedia/           公開サイト用の CSV
    game/                 deck.json fusion.json town.json word_block.json …
```

移すと、スクリプト35本と画面15枚のパスが動く。壊さないための順番:

1. まず新しい置き場へ**コピー**して、両方が在る状態にする
2. スクリプトのパスを1本ずつ新しい側へ向け、**作り直した結果が1バイトも変わらない**ことを
   確かめる(`build_*.py` を回して `git diff` が空)
3. 画面(HTML)の fetch 先を差しかえる
4. ぜんぶ通ったら古い側を消す

**この移動はまだやっていない。** 公開サイトと、いま動いているゲームの読み先を
同時に触ることになるので、進めてよいか決めてから手をつける。

## やってはいけないこと(実際にやらかした)

**よその辞書の名前がついた欄に、こちらが組み立てた文を入れない。**

`det/` の1列目は、画面で「語源解説(ハイパー英語語源辞書)」という見出しで出る。
ここに機械で組み立てた語源の文を入れてしまい、**いまは存在しない辞書の記述**
として生成文が表示された。出典の詐称であり、DBの信用そのものを壊す。

同じ理由で触ってはいけない欄:

| 欄 | 画面の見出し | 中身の出どころ |
|---|---|---|
| `_det[0]` | 語源解説(ハイパー英語語源辞書) | 買った辞書 |
| `_det[1]` | Merriam-Webster | よその辞書 |
| `_det[7]` | 英辞郎 | よその辞書 |
| `_det[8]` | Weblio | よその辞書 |
| `b` | ひとこと | 手で書いたもの |

こちらが組み立てた文を置いてよいのは、出典を明記した専用の欄だけ。
Wiktionary から取ったものは Wiktionary の列に「Wiktionary:」と書いて置く。

## いちばん壊してはいけないもの: 語根の分類

どの語がどの語根に属するか ── この分類は、いちばん古くからある資産で、
機械では作り直せない。語を足すときも、辞書の記述を埋めるときも、
**すでにある語の語根を変えない・消さない。**

    python3 app/check_roots.py --save   # いまの分類を「正」として控える
    python3 app/check_roots.py          # 見くらべる(変わっていたら失敗して止まる)

見ているもの:

- 語ごとの語根の組(`w → p`)。1語でも変わったら、その語の名まえを出す
- 語根ごとの語数。減っていたら出す
- 語根そのものの顔ぶれ(`roots.json` のキー)。消えていたら出す

**語が増えるのはよい。すでにある語の語根が変わる/消えるのがだめ。**
控えは `roots_snapshot.json`(語 18,878 / 語根 1,436)。
データをいじる作業のあとは、必ずこれを通すこと。

なお、辞書の記述を埋める道具は語根に触らない(読むだけ):

| 道具 | 書き出す先 |
|---|---|
| `fetch_refs.py` | `cache_refs/` `refs_*.json` |
| `merge_refs.py` | `det_add.json` |
| `fetch_nonpie.py` | `draft_nonpie.json`(`words.json` は読むだけ) |

## 参考にする辞書の記述(私用)

> **このリポジトリは公開(public / Pages 有効)。**
>   外から見られるように、参照データもここに置く(Nanbara の判断)。
>   置くのは `refs_*.json`(辞書ごと)と `det_add.json`(9列に組んだもの)。
>   生ページの控え(`cache_refs/`)だけは、重いだけで見るものではないので置かない。

`app/fetch_refs.py` が、語ごとに次の3つを控える。**Nanbara が参考にするための
私用データ。公開サイトにも配布物にも混ぜない。**

| 出どころ | 取りかた | 置き場 |
|---|---|---|
| Merriam-Webster | 公式API(`MW_KEY` が要る) | `refs_mw.json` |
| 英辞郎 | eow.alc.co.jp | `refs_alc.json` |
| Weblio 英和 | ejje.weblio.jp(研究社 新英和中辞典 と **ハイパー英語辞書**) | `refs_weblio.json` |

- **ハイパー英語辞書は Weblio で引ける。** サイトは無くなったが、Weblio に
  項目が残っている(`hyper` のキーで控える)
- 取ったものは**そのまま**その辞書の列に置く。要約も言いかえもしない
- 1語ずつ逐次。英辞郎は9秒前後、Weblio は7秒前後あけて取る
- 生のページを `cache_refs/<出どころ>/<語>.raw` に控える。読みかたを直したときは
  `--reparse` で読みなおすだけ ── 取り直さない
- 弾かれたらその場で止めて、どこまで取れたかを言う。同じコマンドで続きから

## 母艦を増やすとき

- 語根に紐づく語 … これまでどおり `words_add_eo.json`
- **語根に紐づかない語** … いまは**DBに入れていない**。
  `app/fetch_nonpie.py` は `draft_nonpie.json`(下書き)を書き出すだけで、
  そこからDBへは自動で入らない。入れるかどうかは、上の「やってはいけないこと」を
  満たす形(出典つきの専用欄)を決めてから。
  取り口じたいは Wiktionary の機械可読版(kaikki.org、CC BY-SA)で、
  **1語ずつ・間をあけて取る**。英辞郎・Weblio・Merriam-Webster は取りにいかない。

---

## 語の欄の書式(必ず守ること)

既存の18,878語を実測して出した決まり。**定義文を入れてはいけない。**
英語も日本語も「短い言いかえ」で揃っている。

| 欄 | 中身 | 長さ(実測の中央値) | 複数のとき |
|---|---|---|---|
| `ja` | 日本語の語義 | **4文字** | 「、」で区切る(全体の5%) |
| `en` | 英語の言いかえ。定義文ではない | **9文字 / 1語** | 「 / 」で区切る(全体の3%) |
| `pos` | 品詞 | 1文字 | 「/」で区切る(名/動) |

```
cow          雌牛              female bovine
wolf         オオカミ            wild canine
water        水                liquid
about        〜について、およそ       regarding / roughly
bear         運ぶ、耐える、産む       carry / endure / give birth
communicate  伝える、感染させる       convey / pass on illness
```

### どの出どころから採るか

| 欄 | 正とする出どころ | 理由 |
|---|---|---|
| `ja` `pos` | **英辞郎**(`refs_alc.json`) | はじめから この書式。`【名】《動物》キリン◆可算` |
| `en` | Wiktionary の定義文を刈りこむ | 英語の言いかえを持つ辞書が無いため |
| `r`(レア度) | Google Ngram → `fetch_ngram_rarity.py` | 元データと同じ式 |
| `_det[1][7][8]` | Merriam-Webster / 英辞郎 / Weblio そのまま | 辞書名が付く欄。作文を入れない |
| `eo/*.json` | etymonline そのまま | 同上 |

**Wiktionary の訳語一覧から `ja` を採ってはいけない。**
1件目が代表とは限らず、giraffe が「麒麟」(中国の神話の獣)、
cat が「家猫」になる。英辞郎を待って、そこから入れる。

### 手で直すとき

生成した値を上書きしたいときは、CSVの台帳に書く(ビルドが勝っても消えない)。

- `word_ja_fix.csv` … 和訳(w,ja,p)
- `word_pos_fix.csv` … 品詞
- `word_r_fix.csv` … レア度
- `word_blurb.csv` … ひとこと(`b`)。ここは人が書く欄で、機械は書かない

### 語義の数は ja と en で一致させる

「、」と「 / 」は**個数も順番も対応する**。

```
しかし、以外   →   however / except
```

こちらは `ja` を英辞郎、`en` を Wiktionary から採っていて、
2つめどうしが同じ語義だとは言い切れない。数を合わせるために
対応しない語義を並べるのは嘘になるので、**多いほうを削って1対1にする**
(`merge_refs.align`)。複数語義を出したい語は、手で `word_ja_fix.csv` に書く。

点検は `python3 app/check_format.py --draft`(語義の数のずれと、
en に定義文が紛れていないかを見る)。

### kaikki とは(紛らわしいので明記)

**Wiktionary そのもの。** 別の辞書ではない。

kaikki.org は Wiktionary の記事を機械が読める JSON にして配っているサイト
(Wiktextract の出力。運営は Tatu Ylönen)。HTML を1ページずつ剥がす代わりに、
1語1行の JSON をもらっているだけ。ライセンスは Wiktionary と同じ CC BY-SA で、
出典を書けば公開してよい。

**画面と `_det[2]` の出典表記は必ず「Wiktionary」**。「kaikki」はコードと
控えの置き場(`cache_kaikki/`)の名まえにしか出てこない。

使いどころ: 語が実在するかの確認 / 英語の言いかえ(`en`)/ 語派の判定(`g`)/
Wiktionary の語源記述(`_det[2]`)。


---

## 役割の分担(2026-08 決定)

| 工程 | やること | 誰が |
|---|---|---|
| 1. 資料あつめ | 各辞書の記述を、その辞書の欄に **そのまま** 控える | ここまでが取得スクリプトの仕事 |
| 2. 語義 | `en`(英語の言いかえ)と `ja`(和訳)を入れる | 同上 |
| 3. **語源の判断** | `g`(語派)など、**どの言語から来たか** | **別の工程**。資料を総合して読む |

**語派(`g`)を機械で埋めてはいけない。** 辞書は同綴りの別語を1つの欄に
まとめて持っているので、機械が1つ拾うと必ず外す。実際に起きた:

```
cash  「南インドの小額貨幣」の語源を拾って ドラヴィダ語
      → 正しくは「現金」でラテン語 capsa(箱)からロマンス語派
boss  同じ理由で 日本語 → 正しくはオランダ語 baas でゲルマン語派
```

資料(9列と `eo/*.json`)は揃えてあるので、それを読み比べて決める。
決まらないものは空のままにする。**推測で埋めない。**

### 資料の揃い具合(足した30,254語)

| 出どころ | 揃った語 |
|---|---|
| Wiktionary の語源 | 27,624語 (91%) |
| Merriam-Webster の語義 | 22,166語 (73%) |
| Weblio | 15,998語 (52%) |
| etymonline の記事 | 12,087語 (39%) |
| 英辞郎 | 10,900語 (36%) |
| Merriam-Webster の語源 | 10,157語 (33%) |


---

## 列の役割(2026-09 確認)

一覧の列は、**取ってくるもの** と **書くもの** に分かれる。混ぜてはいけない。

| 列 | 中身 | 誰が入れるか |
|---|---|---|
| 単語 / カナ / レア度 / 語義(`ja`) | 辞書から取れる事実 | 取得スクリプト |
| **パラフレーズ**(`en`) | 短い英語の言いかえ | **資料を読んだAI**。いまは Merriam-Webster の語義をそのまま置いた仮の値 |
| **語源**(`b`) | 資料を読んで簡潔にまとめた **オリジナルの文** | **資料を読んだAI**。書かれていない語は **空のまま** |
| 印欧祖語(`p`)/ 語派(`g`) | 語根の分類 | もとからの語彙のみ。足した語は空 |
| クリックで出る詳細 | Merriam-Webster・英辞郎・Weblio・Wiktionary・etymonline の記述 **そのまま** | 取得スクリプト |

**語源欄に辞書の記述を流し込んではいけない。** 詳細に同じものが出るので二重になる。

```
誤: theremin の語源欄に「Merriam-Webster: modification of Russian termen-voks …」
正: 空のまま。詳細を開けば Merriam-Webster の欄に同じ文がある
```

**参照データを機械で切ってはいけない。** 辞書の記述は全文を控える。
短く刈りこむと名詞句の途中で切れて、別の意味になる。

```
誤: daguerreotype「early photograph produced on a silver」← plate が消える
誤: club-foot   「congenitally misshapen foot twisted out」← outward が消える
```

切る前の全文が残っていれば あとから短くできるが、切ったものからは戻せない。
