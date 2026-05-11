---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

临时回滚 issue #558 的增强 scoped slot owner 方法透传修复，避免该路径影响更多页面运行；保留 issue #553、#554、#555 已有修复与运行时覆盖。
