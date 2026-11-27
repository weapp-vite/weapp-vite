---
'@mpcore/simulator': patch
'@weapp-vite/i18n': patch
'@weapp-vite/mcp': patch
'@weapp-vite/react': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'@wevu/test-utils': patch
'wevu': patch
---

chore(deps): 同步 @weapp-core/constants 依赖范围

`@weapp-core/constants` 新增 Web Runtime 派生目标与共享判定函数名契约，按发布策略所有公开直接依赖者同步推进依赖范围；本条目不含这些包自身的行为变更。