---
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

复用 Vue SFC 解析缓存：`compileVueFile` 现在会走共享的 SFC parse cache，减少开发模式下连续 SFC HMR 和重复编译时的 `vue/compiler-sfc` 解析开销。
