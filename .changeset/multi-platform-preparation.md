---
'weapp-vite': patch
'create-weapp-vite': patch
---

为多小程序平台支持补齐前置基础设施：新增 `weapp.multiPlatform.targets` 目标集合配置，统一 `multiPlatform` 的 resolved 结果与内部读取入口，并让配置校验、project config 路径提示、watch 与 npm 关系计算共享同一套多平台状态，便于后续继续接入真正的平台矩阵构建能力。
