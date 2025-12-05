---
"rolldown-require": patch
---

fix externalization helper call signature, add persistent cache (validated by mtime/size, default dir with fallbacks), harden temp output fallback (node_modules/.rolldown-require -> tmp -> data URL), and silence intended console warn patch block
