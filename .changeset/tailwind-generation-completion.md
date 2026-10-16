---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 关闭 Tailwind 额外候选缓存的异步预热，由编译会话统一复用增量状态，避免生成返回后继续读取配置或插件文件，在文件更新过程中缓存空模块并导致后续构建失败。
