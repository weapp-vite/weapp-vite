---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 修复支付宝平台 npm 构建与 scoped slot 兼容问题。

- 支付宝平台下对小程序 npm 包增加稳定转换：模板后缀/语法映射、ESM 到 CJS 转换、嵌套依赖提升与缓存自修复，避免 `cannot resolve module`、`unknown is outside of the project` 等报错。
- 支付宝平台下为 `componentGenerics` 自动补齐默认占位组件，并在构建产物中自动发出占位组件文件，修复 `componentGenerics ... 必须配置默认自定义组件`。
- 优化 scoped slot 子组件 `usingComponents` 收敛逻辑，仅保留模板实际依赖，减少无效引用与平台差异问题。
