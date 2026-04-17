---
'create-weapp-vite': patch
'weapp-vite': patch
---

继续补齐多平台构建与模板链路的一致性：新增 `weapp.multiPlatform.targets` 目标集合与统一的 `multiPlatform` 内部读取入口，让配置校验、watch 与 npm 关系计算共享同一套状态；同时让 `--project-config` 报错提示复用真实平台项目配置文件名，页面 layout 包裹分支与 `setData.pick` 判断改为按平台模板指令前缀生效，并将内部散落的默认平台回退收敛到统一 helper，减少支付宝、百度等非微信平台上的默认 `wx:` 假设。
