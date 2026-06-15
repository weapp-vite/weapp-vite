---
"@wevu/compiler": patch
---

优化 OXC AST 引擎下的 wevu 页面特性预检：命中组件工厂调用时直接复用 OXC AST 抽取 options 对象，避免再次进入 Babel 解析链路，降低 HMR 分析阶段的重复解析成本。
