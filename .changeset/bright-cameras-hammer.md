---
'create-weapp-vite': patch
'weapp-vite': patch
---

增强 `weapp-vite` 打开微信开发者工具项目时的默认行为：对微信小程序平台的 `open` / `dev -o` / `build -o` / `ide logs --open` 默认透传 `--trust-project`，减少每次打开新项目时都要手动确认“信任代码”的重复操作。同时保留 `--no-trust-project` 作为显式回退开关，便于在需要时关闭该默认行为。
