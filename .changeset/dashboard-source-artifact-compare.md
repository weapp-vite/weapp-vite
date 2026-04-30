---
"@weapp-vite/dashboard": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

增强 dashboard 源码对比能力：分析视图新增源码与产物只读 Diff 面板，并通过受限文件接口读取 analyze 结果中出现过的项目源码和构建产物，方便定位源码到产物的体积差异。
