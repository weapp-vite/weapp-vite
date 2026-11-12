---
"@mpcore/test": patch
"@mpcore/vitest": patch
---

fix(vitest): 修复小程序 matcher 与 Vitest browser matcher 同时加载时的类型冲突，保留 DOM 断言与异步断言的返回类型，并支持文本数字、非空和显式空白归一化检查。
