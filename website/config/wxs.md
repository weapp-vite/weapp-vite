# WXS 配置 <span class="wv-badge wv-badge--experimental">experimental</span> {#wxs-config}

`weapp-vite` 会对 `.wxs/.sjs`（以及 `.wxs.ts/.wxs.js`）进行编译输出，并在 Vue SFC 的 class/style 运行时中按需使用 WXS。

> [!WARNING]
> WXS 增强仍处于实验阶段（experimental），建议在开发者工具中充分验证编译与运行结果。

[[toc]]

## `weapp.wxs` {#weapp-wxs}
- **类型**：`boolean`
- **默认值**：`true`

### 实际生效范围

- **影响**：Vue SFC 模板编译阶段的 `class/style` 运行时选择（`auto` 时是否优先 WXS）。
- **不影响**：WXML 中显式引用的 `.wxs/.sjs` 仍会被编译输出。

### 示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxs: false, // 禁用 SFC class/style 使用 WXS，强制回退 JS 运行时
  },
})
```

### 常见问题

- **WXML 引用的 `.wxs` 仍然被输出？** 是的，该行为与 `weapp.wxs` 无关。
- **Vue SFC 的 class/style 绑定走 JS 了？** 若设置了 `weapp.wxs = false`，会强制回退到 JS 运行时。

---

相关能力：
- [Vue SFC 配置](/config/vue.md)
- [WXML 配置](/config/wxml.md)
