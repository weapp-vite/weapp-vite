---
"@wevu/web-apis": patch
---

补齐 Web Runtime 兼容层中的低成本 Web API 辅助能力：`URL.parse()`、`URL.canParse()`、`URLSearchParams.size`、`URLSearchParams.sort()`、`Headers.getSetCookie()`、`Response.json()` 与 `Response.error()` 现在可以通过 polyfill 和全局安装链路稳定使用。
