---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强 analyze 的源码与产物读取能力：新增受限文件内容接口，只允许读取 analyze 结果中出现过的项目源码和构建产物，方便上层 UI 定位源码到产物的体积差异。
