---
'weapp-vite': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
---

增强多平台模板兼容处理。`weapp-vite` 现在会按已支持的小程序平台指令前缀集合统一重写模板指令，支付宝 npm 模板转换也能识别并转换来自微信、百度、抖音等平台的条件与循环指令，`injectWeapi.replaceWx` 也会同步挂载所有已支持宿主全局；`@wevu/compiler` 同步放宽模板表达式里的宿主全局白名单，避免 `my`、`tt`、`swan`、`xhs` 等平台全局被误当成本地变量改写，降低支付宝和抖音小程序接入成本。
