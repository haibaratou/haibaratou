【Claude Code への引き継ぎパック】

■ 中身
  CLAUDE.md                         … プロジェクト状況・ルール(Claude Codeが最初に読む)
  KICKOFF_PROMPT.txt                … Claude Code初回にそのまま貼るプロンプト
  app/etymopedia.html               … 語源辞典サイト 最新版(単一HTML)
  app/data/*.csv                    … 辞典の全データ(文言・画像パス)
  app/lexicopia-hakoniwa-v7-mine.html … 旧Claude版ゲームの参考スナップショット(※参照専用)

■ 配置のしかた
  1. ローカルのリポジトリ(D:\haibaratou-main\github など .git のある場所)を開く。
  2. このパックの app/ の中身を、リポジトリの app/ にコピーする。
       - etymopedia.html → app/etymopedia.html を上書き
       - data/ フォルダ  → app/data/ に配置(無ければ作成)
       - lexicopia-hakoniwa-v7-mine.html は参考用。置いても置かなくてもよい。
     ★ app/lexicopia-hakoniwa.html(あなたがCodexで直した本体)は、このパックには
        入れていません。上書きされる心配はありません。そのまま最新版を使ってください。
  3. CLAUDE.md と KICKOFF_PROMPT.txt は、リポジトリの一番上(ルート)に置く。

■ Claude Code のはじめかた(目安。最新手順は公式を確認)
  1. Node.js を入れる。
  2. ターミナルで:  npm install -g @anthropic-ai/claude-code
  3. リポジトリのフォルダに移動して:  claude
  4. KICKOFF_PROMPT.txt の中身をコピーして最初のメッセージに貼る。

  ※ gitのpush認証は、先にローカルで一度通しておくとClaude Codeがそのまま使えます。
     このリポジトリへの Contents: Read-and-write 権限つきトークンが必要です。
