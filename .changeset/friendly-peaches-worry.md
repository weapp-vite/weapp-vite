---
"weapp-vite": patch
"rolldown-require": patch
"create-weapp-vite": patch
---

修复 rolldown 依赖清单被错误写死为具体版本，恢复为 workspace catalog 引用，并补充回归测试避免发布前校验再次因 manifest 漂移失败。
