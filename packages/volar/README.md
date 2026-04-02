# @weapp-vite/volar

## 1. 简介

`@weapp-vite/volar` 是 `weapp-vite` 的 Volar 语言服务插件，用来给小程序 Vue SFC 中的自定义块和相关宏提供更准确的类型、补全和诊断能力。

它主要覆盖：

- `<json>` 自定义块的 schema 与类型提示
- `definePageJson` / `defineComponentJson` 等配置宏配套体验
- `wxs` 模块声明补全
- `script setup` 中为 weapp-vite / wevu 注入的额外声明

## 2. 安装方式

大多数情况下不需要单独安装。

`weapp-vite` 已经依赖并自动启用这个插件，项目里通常只需要按文档配置 `tsconfig.json` / `jsconfig.json` 即可。

如果你要在非标准工程里单独集成，可以安装：

```bash
pnpm add -D @weapp-vite/volar @weapp-core/schematics
```

## 3. 常见配置

```json
{
  "vueCompilerOptions": {
    "plugins": ["weapp-vite/volar"]
  }
}
```

> **注意**：更完整的编辑器接入方式，请优先参考 `weapp-vite` 主包文档中的 Volar 章节。

## 4. 提供的能力

| 能力                    | 说明                                                   |
| ----------------------- | ------------------------------------------------------ |
| `<json>` 块诊断         | 根据 App / Page / Component 语义提供 schema 与类型校验 |
| `script setup` 声明增强 | 自动补齐 weapp 相关额外声明                            |
| `wxs` 模块名收集        | 让模板与脚本中的 `wxs` 使用获得更稳定的类型体验        |
| 自定义块嵌入代码        | 让 Volar 能识别并处理额外代码片段                      |

## 5. 适用场景

- 在 `.vue` 文件里直接编写小程序页面 / 组件配置
- 使用 `definePageJson`、`defineComponentJson` 等宏
- 需要让 VS Code / Volar 正确理解 weapp-vite 的自定义块与扩展语义

## 6. 本地开发

```bash
pnpm --filter @weapp-vite/volar build
pnpm --filter @weapp-vite/volar test
pnpm --filter @weapp-vite/volar typecheck
```

## 7. 相关链接

- 详细用法：[./USAGE.md](./USAGE.md)
- 主包文档：[../weapp-vite/docs/volar.md](../weapp-vite/docs/volar.md)
- `weapp-vite`：[../weapp-vite/README.md](../weapp-vite/README.md)
