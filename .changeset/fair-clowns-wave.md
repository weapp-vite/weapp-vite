---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生小程序构建中复制型 `miniprogram` npm 包的 ESM `default` 互操作问题：当 `tdesign-miniprogram/dialog` 这类依赖以 `export default` 形式发布时，构建产物现在会在缓存与输出阶段统一归一化为带 `__esModule` 标记的 CommonJS，避免页面侧 `require + __toESM` 再次包裹默认导出，导致 `Dialog.confirm is not a function` 一类双层 `default` 报错。
