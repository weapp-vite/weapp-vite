---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 Stateful HMR 交付快照重复生成 Tailwind 候选的问题，仅在同批封存源码、显式样式入口、配置及依赖均一致时交接生成结果。快照保留独立编译器、转换和映射组合；输入或入口归属变化时沿原流程完整重同步，普通构建及未满足准入条件的场景保持独立生成。
