---
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-vite/eslint": patch
---

新增共享 Doctor 检查引擎及 CLI/API，分离只读静态检查、显式构建产物与已打开宿主的页面探针，提供终端、JSON、SARIF 报告及完整性退出码。复用平台注册表、兼容规则与包体预算，并修正运行时 ESLint 对自定义实例方法的误报及数组/字符串同名方法覆盖问题。
