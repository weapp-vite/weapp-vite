---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 在 Vue SFC 模板中引用外部 `wxs` 文件时的产物缺失问题：调整 `wxs` 资源收集与发射时机，补充对 `generateBundle` 阶段 `wxml` 资产的依赖扫描，并兼容 `wxs` / `sjs` / `import-sjs` 标签，确保 `<wxs ... />` 与 `<wxs ...></wxs>` 两种写法均可自动输出到 `dist`。

同时移除 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中的 `copy-wxs-sidecar` 构建兜底插件，改为完全依赖 `weapp-vite` 核心链路自动处理 `wxml` 引入的 `wxs` 文件，避免模板侧重复拷贝逻辑。
