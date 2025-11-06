# WXS 配置 {#wxs-config}

WXS（WeiXin Script）承担着在模板中补充运行时代码的角色。`weapp-vite` 在保持语法兼容的基础上，为 WXS 引入了模块化解析、现代语法支持和按需编译能力。通过顶层的 `weapp.wxs` 开关，你可以自由启用或禁用这些增强。

[[toc]]

## `weapp.wxs` {#weapp-wxs}
- **类型**：`boolean`
- **默认值**：`true`
- **适用场景**：
  - 希望使用 ES2018+ 语法、`import`/`export` 等增强能力，由构建器编译为原生可运行代码。
  - 需要在调试时保留原生行为，或因兼容性考虑暂时回退到微信开发者工具的默认编译。

### 配置示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    wxs: true, // 默认即为 true，可显式声明便于团队理解
  },
})
```

若希望关闭增强，保留最基础的语法，可以将该选项设为 `false`：

```ts
export default defineConfig({
  weapp: {
    wxs: false,
  },
})
```

### 常见问题

- **模板里使用新语法报错？** 请确认 `wxs` 开关已开启，同时确保文件后缀为 `.wxs`。weapp-vite 会自动将其纳入构建流程。
- **需要调试原始代码？** 临时关闭 `wxs` 后重新运行 `pnpm dev`，生成的产物会直接回退到原生脚本，以便定位问题。
- **与第三方工具冲突？** 某些内网或历史项目可能依赖旧版编译行为，可在短期内关闭增强，并结合 [共享配置](/config/shared.md#weapp-debug) 的调试钩子逐步迁移。

## 调试建议

1. **观察产物**：在 `dist/` 中查看编译后的 `.wxs` 文件，确认是否包含期望的语法转换。
2. **配合 `watchFiles`**：通过 `weapp.debug.watchFiles` 输出监听列表，确保对应 `.wxs` 已被收集处理。
3. **分包排查**：若分包中引用的 `.wxs` 未更新，可检查分包根目录是否命中 `srcRoot` 配置，详见 [基础目录与资源收集](/config/paths.md#paths-config)。

## 关联阅读

- [WXML 配置](/config/wxml.md)：了解模板层增强与 WXS 在事件处理上的协同。
- [分包配置](/config/subpackages.md)：确认分包场景下 WXS 的编译输出位置。
