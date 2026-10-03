---
"weapp-vite": minor
"create-weapp-vite": patch
---

修复 tsconfig 数组继承、包配置继承和子配置 paths 覆盖语义，保持受管配置生成前的 prepare 容错。高级路径适配固定到移除 tsconfck 旧 TypeScript peer 限制的 vite-tsconfig-paths 7.0.0-alpha.3；保留旧 parseNative 配置的类型兼容并标记弃用，新解析器统一处理继承和路径，不再通过该选项加载 TypeScript 编译器。
