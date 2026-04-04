---
'@weapp-core/shared': patch
---

将 `@weapp-core/shared` 导出的 `objectHash` 从 `object-hash` 依赖切换为内置的稳定序列化加 `sha256` 哈希实现，移除已被禁用的直接依赖，同时保持现有导出接口不变，避免影响下游缓存签名调用。
