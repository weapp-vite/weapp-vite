---
"@wevu/api": patch
---

继续移除 `@wevu/api` 的非等价映射：抖音侧 `getVideoInfo` 不再映射到 `getFileInfo`，在缺少同等 API 的情况下统一返回 unsupported；并同步删除对应无效参数转换逻辑、更新测试和兼容报告。
