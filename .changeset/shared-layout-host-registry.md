---
"@weapp-core/shared": patch
---

新增小程序 layout host 注册表工具，用于统一按页面身份 key 注册、解析、等待和注销 layout 宿主实例。`wevu` 与 `weapp-vite/runtime` 现在复用同一套底层逻辑，避免两边维护重复的注册表实现。
