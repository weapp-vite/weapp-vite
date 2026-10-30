---
"@weapp-vite/web": patch
"@weapp-core/constants": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/react": patch
"@wevu/web-apis": patch
"@wevu/compiler": patch
"@wevu/test-utils": patch
"@mpcore/simulator": patch
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

fix(web): 保留 data-* 完整表达式的原始值类型。

编译模板与旧字符串模板的事件、组件事件、选择器和交叉观察器保留数字、布尔值、对象及数组，修复这些值被字符串化的问题；DOM 属性仍可按字符串查询，更新、移除和重新连接时读取保持正确。

HTML 属性名按 DOM 的 ASCII 大小写规则归一，避免 `data-itemName` 与 `data-item-name` 串值；SVG/XML 保留大小写敏感语义。

模拟器的交叉观察器回调同样保留 dataset 原始值类型，与事件和选择器读取保持一致。
