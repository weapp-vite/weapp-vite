---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Tailwind 快照在多个根入口间漏检一次性迭代输入的问题，并在最终校验中按原始绝对路径去重，避免重复匹配同一源码；保留已删除的编译输入、扫描新增文件与 CSS 依赖的封存校验。
