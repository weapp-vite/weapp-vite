# 构建输出与兼容 {#build-and-output}

`weapp-vite` 默认输出 CommonJS（`cjs`），并把编译目标保持在 ES2015+。大多数项目不需要额外配置就能在微信开发者工具和真机上跑起来。

如果你有更“极限”的兼容需求：

- 需要支持非常旧的环境：可以开启 `weapp.es5` 做 ES5 降级
- 想输出原生 ESM：可以把 `weapp.jsFormat` 切到 `esm`

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

- `cjs`（默认）：输出 CommonJS，目标 ES2015+。最稳妥，兼容大部分第三方依赖。
- `esm`：输出 ESM，目标仍为 ES2015+。建议同时在 **微信开发者工具 → 本地设置** 勾选「ES6 转 ES5」，让 IDE 负责回退，减少预览/真机差异。

> [!NOTE]
> `weapp-vite` 会校验 `build.target`：如果你显式把它设到 ES2015 以下（例如 `es5` / `es2014`），会直接报错。只有在启用 `weapp.es5` 时才允许降级到 ES5。

## `weapp.es5` {#weapp-es5}
- **类型**：`boolean`
- **默认值**：`false`
- **适用场景**：确实要在非常旧的环境里运行，并希望由构建阶段把产物降级到 ES5。

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

- 只在 `jsFormat === 'cjs'` 时有效；和 `esm` 一起用会报错。
- 需要安装 `@swc/core`：`pnpm add -D @swc/core`。
- 开启后会先按 ES2015 产出，再在写入前用 SWC 转成 ES5。
- ES5 降级会增加构建时间与包体积，建议只在确实需要时开启。

> [!TIP]
> 即便开启了 `weapp.es5`，仍建议在微信开发者工具中保持「ES6 转 ES5」开启，以降低真机/预览阶段的潜在差异。

---

完成配置后，建议重新执行 `pnpm build`，并在微信开发者工具中验证调试、预览与上传流程是否符合预期。
