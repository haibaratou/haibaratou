# Codex Handoff

> **まず `README-AIのための取扱説明書.md` を読むこと。**
> リポジトリの構成・push の道すじ・語源データベース(英語/日本語)の
> 作りかたと、やってはいけないことが全部そこにある。

This repository is the Wild Wordopia mobile HTML prototype.

Before making changes, read:

- `docs/CODEX_HANDOFF.md`

Working rules:

- Do not ask the user for routine read, analysis, edit, or GitHub sync decisions.
- Prefer adding comparison HTML files under `app/` instead of replacing the main prototype.
- Keep work mobile-first.
- Commit useful handoff/prototype changes and create a PR through the Codex/GitHub integration so another PC can continue without chat history. Do not run `git push` from the sandbox when GitHub egress is blocked; direct push is expected to fail with proxy errors in cloud tasks.

Hard rules (details in docs/CODEX_HANDOFF.md — read it first):

- NEVER read or parse files under `app/data/pie/` (5-26MB JSON; doing so burns the whole token budget). Work lists live in `tools/*.csv`; regenerate with `python3 app/build_art_todo.py`.
- Do not confuse the two etymon datasets: `app/data/pie/` = 語源データベース (1,437 roots, the illustration target) vs `app/data/*.csv` = エティモペディア mock (only 8 roots). "All etymons already exist" based on the 8-root CSV is wrong.
- Image filenames: use the ファイル名 column of `tools/word-art-todo.csv` / `tools/root-art-todo.csv` verbatim. Never derive filenames from spellings yourself. Homograph senses use the `word@rootslug.png` form — never overwrite a shared `word.png` with a different sense.

