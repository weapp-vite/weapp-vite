---
'@wevu/compiler': patch
---

为 `@wevu/compiler` 增加中性的默认模板平台导出 `defaultMiniProgramTemplatePlatform`，方便外部工具和多平台接入代码复用默认模板适配器时，不再继续依赖 `wechatPlatform` 这类偏微信语义的命名。
