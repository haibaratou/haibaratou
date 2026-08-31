# 不足画像一覧（レキシコピア・ファブル）

現状は既存素材(assets/chara, assets/word, assets/ground)と、CSSの仮建物枠
(色付き屋根+名前ラベル)で仮実装している。画像パスを差し替えるだけで本番化できる。

| asset ID | 使用場所 | 必要な内容 | 推奨サイズ | 透過 | 想定ファイル名 | 現在の仮素材 |
|---|---|---|---|---|---|---|
| bld_tree | 町の中央 | アルファベット樹(大樹+文字の実) | 460x520 | 要 | assets/fable/bld_tree.png | CSS仮建物枠 |
| bld_farm | 町・牧場 | 柵つき牧場と牧舎 | 400x300 | 要 | assets/fable/bld_farm.png | CSS仮建物枠 |
| bld_kitchen | 町・厨房 | 煙突つき厨房 | 340x300 | 要 | assets/fable/bld_kitchen.png | CSS仮建物枠 |
| bld_hq | 町・遠征本部 | 旗の立つ本部小屋 | 400x320 | 要 | assets/fable/bld_hq.png | CSS仮建物枠 |
| bld_library | 町・図書館 | 本の看板の図書館 | 360x320 | 要 | assets/fable/bld_library.png | CSS仮建物枠 |
| bld_observatory | 町・観測台 | 望遠鏡つきの塔 | 300x380 | 要 | assets/fable/bld_observatory.png | CSS仮建物枠 |
| bld_plaza | 町・広場 | 舞台と旗かざり | 440x260 | 要 | assets/fable/bld_plaza.png | CSS仮建物枠 |
| bld_market | 町・市場 | 屋台と天秤 | 360x280 | 要 | assets/fable/bld_market.png | CSS仮建物枠 |
| enemy_(12種) | 戦闘 | 各通常敵(こけ犬/とげねずみ/丸太ガニ/霧の蛾/さびゴーレム/影ねこ/ガラスからす/インクスライム/しおガニ/霧笛/難破だこ/しおの精) | 各420x420 | 要 | assets/fable/enemy_<id>.png | ●の丸シルエット(CSS) |
| boss_jab_moss | 森ボス | ジャバの森喰い | 640x640 | 要 | assets/fable/boss_jab_moss.png | 👹仮表示 |
| boss_jab_silence | 都市ボス | ジャバの沈黙 | 640x640 | 要 | assets/fable/boss_jab_silence.png | 👹仮表示 |
| boss_jab_deep | 海岸ボス | ジャバの深潮 | 640x640 | 要 | assets/fable/boss_jab_deep.png | 👹仮表示 |
| word_(不足分) | 復活カード/住民 | biceps, heading, ahead, headquarters, achievement, survey, evidence, famous, fate など assets/word に絵の無い語 | 各512x512 | 要 | assets/word/<w>.png | 単語名入り仮カード(CSS .ph) |
| bgm_town / bgm_expedition / se_* | 全体 | BGM2曲+効果音(決定/回収/勝利/敗北) | - | - | assets/fable/audio/* | 無音(音量設定のみ実装) |
