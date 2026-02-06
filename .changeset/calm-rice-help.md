---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(alipay): 兼容 antd-mini 文档的 `antd-mini/es/*` 组件路径。

- 支付宝 `node_modules` npm 模式下，miniprogram 包构建时会同步复制包内 `es/` 目录到产物，避免 `usingComponents` 指向 `antd-mini/es/*` 时找不到组件文件。
- 修复支付宝 npm 缓存命中时的重建判定：当源包存在 `es/` 但缓存产物缺失时，会自动触发重建，避免继续复用旧产物。
- `alipay-antd-mini-demo` 示例切换为 antd-mini 文档一致写法：`usingComponents` 使用 `antd-mini/es/Button/index`。
