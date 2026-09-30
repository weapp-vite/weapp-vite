---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `project.config.json` 与 `project.private.config.json` 合并优先级与微信官方语义相反的问题。官方约定私有配置中相同设置的优先级更高，此前实现却以基础配置覆盖私有配置，导致上传等场景读取 `appid` 等字段时忽略私有配置。现改为私有配置优先，并使用深合并保留双方 `setting` 内的编译设置，避免基础配置中的 `es6`、`packNpmManually` 等公共设置被整体覆盖丢失。