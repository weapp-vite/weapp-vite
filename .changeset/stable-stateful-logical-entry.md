---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 stateful HMR 根逻辑入口首次构建与后续更新的自接收包装不一致，避免入口内容漂移和热更新失效。
