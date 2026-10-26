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

fix(web): 修复完整表达式的 `data-*` 值被字符串化的问题。编译模板与旧版字符串模板的事件、组件事件、选择器和交叉观察器现在保留数字、布尔值、对象及数组，同时维持 DOM 属性的字符串查询行为，并正确处理更新、移除和重新连接。

HTML 属性名按 DOM 的 ASCII 大小写规则归一，避免 `data-itemName` 与 `data-item-name` 串值；SVG/XML 保留大小写敏感的属性语义。

同步发布共享常量的直接依赖包及生成器，确保发布后的依赖范围包含旧模板 dataset 提交标记。

补齐 simulator 交叉观察器回调的 typed dataset，与事件和选择器读取使用同一来源；新增可在 DevTools 与 headless 复用的原生对象 dataset 回归场景。
