# 构建输出与兼容 {#build-and-output}

`weapp-vite` 默认输出 CommonJS，并保持编译目标在 ES2015 及以上。对绝大多数项目来说，这意味着无需额外配置即可在微信开发者工具与真机上运行。若需要兼容更老设备，可启用内置的 ES5 降级；而当项目准备拥抱原生 ESM 时，也可以一键切换输出格式。

[[toc]]

## `weapp.jsFormat` {#weapp-jsformat}
- **类型**：`'cjs' | 'esm'`
- **默认值**：`'cjs'`
- **适用场景**：
  - 沿用 CommonJS 管线，结合微信开发者工具的「ES6 转 ES5」即可兼容旧环境；
  - 需要直接产出 ESM 并利用更现代语法能力时，将其切换为 `'esm'`。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    jsFormat: 'esm',
  },
})
```

### 输出行为

- `cjs`（默认）：输出 CommonJS，编译目标不少于 ES2015。适合大部分项目与第三方依赖。
- `esm`：输出 ESM，产物仍为 ES2015+。建议同时在 **微信开发者工具 → 本地设置** 中勾选「ES6 转 ES5」，让 IDE 处理回退逻辑。

> [!NOTE]
> `weapp-vite` 会在解析配置时校验 `build.target`。若显式指定的值低于 ES2015（例如 `es5` / `es2014`），会直接抛错。只有在启用 `weapp.es5` 时才允许进行 ES5 降级。

## `weapp.es5` {#weapp-es5}
- **类型**：`boolean`
- **默认值**：`false`
- **适用场景**：需要在非常旧的运行环境中执行 CommonJS 产物，并希望在构建阶段完成 ES5 降级。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    jsFormat: 'cjs',
    es5: true,
  },
})
```

### 使用须知

- 仅当 `jsFormat === 'cjs'` 时有效；若与 `esm` 联用会抛出配置错误。
- 依赖 `@swc/core` 完成降级，请先安装：`pnpm add -D @swc/core`。
- 启用后，构建流程会强制将 bundler 目标锁定为 `es2015`，并在产物流出前使用 SWC 转换为 ES5。
- 降级会增加构建时间与包体积，建议仅对确实需要支持的旧机型开启。

> [!TIP]
> 即便开启了 `weapp.es5`，仍建议在微信开发者工具中保持「ES6 转 ES5」开启，以降低真机/预览阶段的潜在差异。

---

完成配置后，建议重新执行 `pnpm build`，并在微信开发者工具中验证调试、预览与上传流程是否符合预期。
