# Public repository boundary

この公開リポジトリは、GitHub Pagesへ配信する生成済みファイルだけを置きます。

## 原則

- ここを開発の母艦として手編集しません。
- 語源データは非公開 `etymon-source` から生成します。
- ゲームは非公開 `etymon-game-lab` で開発・検査してから反映します。

## 公開禁止

- `app/data/pie/**`
- `det/**`、`eo/**`、`refs_*.json`、`det_add.json`
- 人手修正台帳、取得キャッシュ、APIキー、環境ファイル
- Python、制作資料、参考キャプチャ、作業中ファイル

公開前に禁止パスが0件であることと、主要ページが生成元と一致することを確認します。

## 公開用語源データ

公開ゲームは `app/data/generated-etymon/**` を読みます。このフォルダは手編集せず、
非公開母艦の `etymon-source/app/export_public_game_data.py` で更新します。
公開禁止の辞書詳細・取得キャッシュは生成対象に含めません。
