---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复无 native binding 环境下开发与测试链路的稳定性：并发读取 JSON 配置时在 LRU 缓存缺失但文件签名仍新鲜的情况下会回退读取磁盘，避免 `app.json` 偶发解析失败；同时修复 Vue SFC `definePageJson` 更新被误判为 style-only HMR 后页面 JSON 不刷新、`<style src>` 依赖更新时复用旧 style block 缓存导致 wxss 不刷新，以及生产构建复用 prepare 预扫描后未在清空的 `dist` 中重新写出 auto-import dts 的问题。
