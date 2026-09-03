# AIのための取扱説明書

このリポジトリを引き継ぐAIは、**まずこれを読む**。
データそのものの決まりは `app/data/README-データの地図.md` にある。
ここに書くのは「どこに何があり、どう動かし、どこへ出すか」。

---

## 0. 最初の5分

```bash
git -C /home/user/haibaratou       log --oneline -3    # 作業用
git -C /home/user/etymon-source    log --oneline -3    # 母艦
git -C /home/user/haibaratou-pub   log --oneline -3    # 配信先
ps aux | grep [f]etch_               # 取得スクリプトが動いていないか
```

**取得スクリプトが動いていたら、止めない。** ディスクの控えは残るので落ちても
データは失われないが、待ち時間は返ってこない。

---

## 1. リポジトリは3つ。役割が違う

| リポジトリ | 中身 | 公開 |
|---|---|---|
| `haibaratou/etymon-source` | **母艦**。語源データの正本。ここが唯一の真実 | 非公開 |
| `haibaratou/haibaratou` | 配信先。GitHub Pages でサイトとゲームを出す | 公開 |
| `haibaratou/etymon-game-lab` | ゲームの開発・検査 | — |

ローカルの控えは3つある。

| 場所 | 使いかた |
|---|---|
| `/home/user/haibaratou` | **作業用**。編集と生成はここでやる。19GBの控えと生データがある |
| `/home/user/etymon-source` | 母艦へ push するための正常なクローン |
| `/home/user/haibaratou-pub` | 配信先へ push するための正常なクローン |

### ★ 作業用クローンからは push できない

`/home/user/haibaratou` の履歴は、GitHub の `main` と**共通の祖先を持たない**。

```bash
$ git merge-base origin/main HEAD
(何も出ない)
```

このため push すると 3GB の全履歴を送ろうとして `index-pack failed` で弾かれる。
`--no-thin`・`http.postBuffer` 拡大・`pack.windowMemory` 制限、どれも効かない。
**これは不具合ではなく、このクローンの成り立ちによるもの。直そうとして時間を使わない。**

### push の手順(これが唯一の正しい道)

作業用で作ったファイルを、正常なクローンにコピーしてから push する。

```bash
cd /home/user/haibaratou

# 1) 母艦へ ── 生データ・控え・スクリプト、ぜんぶ
cp app/data/ja/ja_*.json app/data/ja/ja_words.txt /home/user/etymon-source/app/data/ja/
cp app/data/ja/ja_det/*.json /home/user/etymon-source/app/data/ja/ja_det/
cp app/build_ja_*.py app/fetch_ja_refs.py /home/user/etymon-source/app/
cd /home/user/etymon-source && git add -A && git commit && git push origin main

# 2) 配信先へ ── 画面が読むものだけ(索引と本文。生データは出さない)
cd /home/user/haibaratou
cp app/data/ja/ja_index.json /home/user/haibaratou-pub/app/data/ja/
cp app/data/ja/ja_det/*.json /home/user/haibaratou-pub/app/data/ja/ja_det/
cd /home/user/haibaratou-pub && git add -A && git commit
git push origin HEAD:main
git push origin HEAD:claude/etymoringo-spec-n5g38o   # 指定ブランチも同じ内容にしておく
```

作業用クローンでも commit はしておく(履歴の控えとして)。push できないのは承知のうえ。

---

## 2. 絶対にやってはいけないこと

過去に実際にやらかして、叱られたもの。**例外はない。**

| してはいけない | なぜ |
|---|---|
| **語源を捏造する** | 買った辞書の名がつく欄に生成文を入れた。出典の詐称。DBの信用が消える |
| **参照データを機械で切る** | 名詞句の途中で切れて別の意味になる。全文があれば後で短くできるが、逆はできない |
| **語源欄に辞書の記述を流し込む** | 詳細に同じ文が出るので二重になる。語源欄は資料を読んだAIが書く欄 |
| **Wiktionary を機械で処理して語源を決める** | 同綴りの別語を混ぜて持っているので必ず外す。参考資料であって、機械にかける材料ではない |
| **既存の語根の分類を変える・消す** | いちばん古い資産で作り直せない。語が増えるのはよい |
| **API鍵をファイルに書く** | `MW_KEY` は環境変数だけ |

作業のあとは必ず通す。

```bash
python3 app/check_roots.py     # 語根の分類が変わっていたら失敗して止まる
python3 app/check_format.py    # 語義の書式
```

---

## 3. 英語の語源データベース(`app/data/pie/`)

**49,127語 / 語根 1,436**。詳しくは `app/data/README-データの地図.md`。

覚えておくこと3つ。

1. `words.json` の `b`(語源)と `en`(パラフレーズ)は、**資料を読んだAIが書く欄**。
   いま `b` は 30,249語が空、`en` は 9,302語が空で、残りは Merriam-Webster の
   語義を置いた**仮の値**。仮であることが分かるようにしてある。
2. `det/<初文字>.json` は9列。`[0]`ハイパー英語語源辞書 `[1]`Merriam-Webster
   `[2]`Wiktionary `[3]`見出し `[4]`発音 `[5]`カナ `[6]`音節 `[7]`英辞郎 `[8]`Weblio。
   **どれも取ってきた記述そのまま。作文を入れる欄はひとつも無い。**
3. レア度の式は**すでにある**。新しく考えない。
   `corpus=eng_2021 / year=2021 / smoothing=3`、`r = round(-943.38 + 303.48 * (-log10 f))`

---

## 4. 日本語の辞書データベース(`app/data/ja/`)

英語DBとは別物。**イラストを流用できるのが最大の持ち味。**

### できあがるもの

| ファイル | 中身 | 誰が読む |
|---|---|---|
| `ja_seed.json` | 見出し・読み・品詞・英訳・絵。JMdict から作る | 次の工程 |
| `ja_words.txt` | 見出しだけの一覧。取得スクリプトが食う | `fetch_ja_refs.py` |
| `ja_refs_kotobank.json` | コトバンクの記述**そのまま**(辞書名つき) | 母艦。画面には出さない |
| `ja_dict.json` | 上を組んだ本体 | 母艦 |
| `ja_index.json` | 画面が起動時に読む索引(軽い) | `app/ja-dict.html` |
| `ja_det/<五十音行>.json` | 開いた語のぶんだけ取りにいく本文。10分割 | 同上 |

### 作る順番

```bash
# 1) 見出しを作る(JMdict から。よく使う印のある語だけ)
curl -O http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
python3 app/build_ja_seed.py --jmdict JMdict_e.gz \
        --images assets/word --words app/data/pie/words.json

# 2) 辞書の記述を取ってくる(何時間もかかる。放っておく)
python3 app/fetch_ja_refs.py --words app/data/ja/ja_words.txt --src kotobank

# 3) 組む
python3 app/build_ja_dict.py
```

読みかたを直したときは `--reparse` を付ける。**取り直さない**(ディスクの控えを読み直すだけ)。

```bash
python3 app/fetch_ja_refs.py --words app/data/ja/ja_words.txt --src kotobank --reparse
```

### 出どころ

**コトバンク一本。** デジタル大辞泉 / 精選版 日本国語大辞典 / 大辞林 /
実用日本語表現辞典 だけを採り、それ以外は捨てる(`fetch_ja_refs.py` の `KEEP`)。

- goo辞書はこの環境から繋がらない。同じデジタル大辞泉をコトバンクが配信している
- Weblio も試したが デジタル大辞泉 が重なるだけだった。二度取らない
- **白名簿を外さない。** 外すと ウィキペディア・隠語大辞典・がん用語辞書まで入る

### 見出しと読みの決めかた(何度も間違えた所)

JMdict は1項目に漢字表記と読みを何通りも並べ、印を付けている。
**「最初に書いてあるもの」を採ってはいけない。**

| 規則 | 理由 / 例 |
|---|---|
| `rK`/`sK`/`oK`/`iK`(まれな漢字表記)は見出しにしない。かなを見出しにする | JMdict 自身が「漢字で書かない語」と言っている。彼の→**あの**、お握り→**おにぎり**、嚏→**くしゃみ**(347語) |
| 同じ漢字を複数項目が名のるときは、印の数・語義の多さ・注記で主を選ぶ | 先着順だと 人→**じん**、彼→**あれ** になる |
| 接尾辞・接頭辞・助数詞だけの項目は主にしない | 人=じん(-ian)・にん(助数詞)より **ひと** |
| 注記(`misc`)は**第一語義のものだけ**見る | 上は5番目の語義の `arch` で うえ が落ち **かみ** になっていた |
| **新聞頻度(`news1`/`nf`)は使わない** | 頻度は「空」という書かれた形で測るので から と そら を区別できない。使うと 空→**から**、下→**もと** になる |
| 読みの並び順は **デジタル大辞泉の見出し順**を正本にする | 山 → やま・さん・むれ。`［漢字項目］` は字の解説なので除く |

大辞泉が未取得の語は JMdict の順で出し、**取得が進むと自動で大辞泉順に直る**。
ほかの読みも落とさず後ろに残す。

### 英語の言いかえ(見出しの下に出る文)

JMdict の英訳から作る。**文は切らない。**

- 長いものを刈りこむのではなく、**短いものを選ぶ**
- どれも長いときは、いちばん目の訳を**そのまま**出す(20,763語中50語)
- 括弧の添え書き(`(esp. the domestic cat, Felis catus)`)は言いかえの行から外す。
  これは文を途中で切るのとは違う。もとの記述は `gl` と辞書の欄に残る
- 画面が狭くて溢れたら CSS の側で `…` と省く。**データは欠けさせない**

### 絵の流用

`assets/word/*.png`(英単語DBのイラスト)を、意味が同じ語に当てる。

- **第一語義の いちばん目 の訳だけ**で当てる。二番目まで見にいくと
  `手 (hand; arm)` に arm(腕)の絵が付く
- 英単語DBの和訳がこの見出しと一致するときも当てる(腹部 → abdomen.png)
- いま **5,291語**に絵が付く。`猫`・`犬`・`花`・`雨` は PNG が無いので付かない
  (取りちがえではなく素材不足)

### いまの進み具合

| | |
|---|---|
| 見出し | 20,763語 |
| 絵が付いた語 | 5,291語 |
| コトバンクの記述が入った語 | 2,696語(取得中。全部で20,763語ぶん) |

`ja_dict.json` の `ja`(まとめた語義)と `gen`(語源)は**空**。
これは資料を読んだAIが書く欄で、取得スクリプトは触らない。英語DBと同じ分担。

---

## 5. 画面

| ファイル | 何 |
|---|---|
| `app/ja-dict.html` | 日本語辞書。左に一覧、右に本文の二面 |
| `app/etymon-explorer.html` | 英語の語源データベース閲覧 |
| `app/etymopedia.html` | 公開用の語源辞典(モック) |
| `app/lexicopia-hakoniwa.html` | ゲーム本体。**勝手に上書きしない**(Codex修正版が正) |

確かめかた。

```bash
cd /home/user/haibaratou-pub && python3 -m http.server 8781 &
# → http://localhost:8781/app/ja-dict.html
```

Playwright は入っている(`/opt/pw-browsers/chromium`)。ESM から使うときは
`/tmp/node_modules` に `/opt/node22/lib/node_modules/playwright` を symlink する。
`playwright install` は**実行しない**。

---

## 6. コンテナが落ちたとき

このセッションでは8回落ちた。**ディスクの控えは毎回残っていて、データは1件も失っていない。**

1. `ls app/data/ja/cache/kotobank/*.raw | wc -l` で控えの数を見る
2. `--reparse` で読み直す
3. 母艦へコピーして commit & push
4. 取得を再開する(同じコマンド。取れているものは飛ばす)

**落ちるたびに reparse して push する。** 溜めない。
