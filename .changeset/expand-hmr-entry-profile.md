---
"weapp-vite": patch
"create-weapp-vite": patch
---

细化 HMR profile 中 page/component 入口加载阶段的耗时拆分，补充脚本读取、JSON 读取、模板扫描、自动导入、样式 sidecar 扫描/读取、入口 resolve、入口 chunk emit 和 layout 处理等子项，方便定位热更新真实瓶颈；同时在 direct script HMR 中复用已缓存的入口 JSON，减少未变更配置文件的重读和重解析。
