---
create-weapp-vite: patch
---

移除多平台模板中未被用户源码直接使用的 `lit` 与 `vite` 依赖，避免生成项目安装不必要的直接依赖。
