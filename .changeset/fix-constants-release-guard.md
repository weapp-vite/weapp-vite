---
"@weapp-core/constants": patch
"weapp-vite": patch
"create-weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"@weapp-vite/web": patch
"@wevu/web-apis": patch
---

修复 `weapp-vite` 等公开包对 `@weapp-core/constants` 发布依赖被锁定为精确版本的问题，并补充 constants 包变更必须带 changeset 的发布校验，避免共享常量新增导出后用户安装到旧版 constants 产物时出现运行时报错。
