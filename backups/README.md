# backups

舊版程式碼備份，**不會被編譯或部署**，只供對照與回復。
Old versions of source files, kept for reference / rollback only. **Not built or deployed.**

## 2026-10-23_before-upgrade

第一輪修復與第二輪格鬥畫面升級之前的版本（保留原本的資料夾結構）。
Versions from before the bug-fix round and the combat visual upgrade (original folder layout kept).

| 來源 Source | 說明 Notes |
|---|---|
| `backend/`、`fronted/`（大部分檔案） | 取自 commit `0462d8c`（升級前 GitHub 上的版本） / taken from commit `0462d8c` |
| `fronted/src/routes/arena.tsx` | 升級前從未 commit 的原始版本 / original version that was never committed |
| `fronted/src/components/crpg/StoryBattleArena.tsx` | 升級前版本（已含「戰鬥中角色無法移動」修正） / pre-upgrade version (already contains the "can't move" focus fix) |
| `fronted/src/components/crpg/StoryWorldStage.tsx` | 沒有任何地方使用的舊元件，從 `src` 移到這裡 / unused component moved out of `src` |

要回復某個檔案：把它複製回原本的路徑即可。
To restore a file, copy it back to the same path under the project root.
