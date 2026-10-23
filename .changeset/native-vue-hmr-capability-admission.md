---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复原生 Vue 文件未声明为编译器附加依赖时绕过 HMR 能力检查的问题。模板注册变化在编译前直接交接 classic；脚本更新缺少已发布源码基线或注册能力证明时也安全回退，避免无效编译和后续更新超时。
