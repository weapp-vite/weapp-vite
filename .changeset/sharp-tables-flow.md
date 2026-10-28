---
"@mpcore/simulator": patch
---

fix(simulator): 修正冷启动导航回调顺序，在 App 启动栈退出后、目标页面 ready 前交付 success 和 complete。
