---
title: 库模式配置
description: Weapp-vite 的 lib 模式用于构建小程序组件库或业务模块。本页聚焦 weapp.lib 的入口、输出路径、组件 JSON 和 DTS 选项。
keywords:
  - 配置
  - config
  - lib
  - 库模式
  - weapp.lib
  - Weapp-vite
---

# 库模式配置 {#lib-config}

`weapp.lib` 用于把 `weapp-vite` 切换到 **库模式**：只构建你声明的入口及其依赖，不生成 `app.json`、页面路由和应用级产物。

如果你想先理解使用场景、模板结构和完整产物示例，先看 [组件库构建（lib 模式）](/guide/lib-mode)。本页只聚焦配置项本身。

[[toc]]

## `weapp.lib` {#weapp-lib}
- **类型**：
  ```ts
  {
    entry: string | string[] | Record<string, string>
    root?: string
    outDir?: string
    preservePath?: boolean
    fileName?: string | ((ctx: { name: string; input: string }) => string)
    componentJson?: boolean | 'auto' | ((ctx: { name: string; input: string }) => Record<string, any>)
    dts?: boolean | {
      enabled?: boolean
      mode?: 'internal' | 'vue-tsc'
      internal?: {
        tsconfig?: string | false
        compilerOptions?: CompilerOptions
        vueCompilerOptions?: Record<string, any>
      }
      rolldown?: RolldownDtsOptions
      vueTsc?: {
        tsconfig?: Record<string, any>
        compilerOptions?: CompilerOptions
        vueCompilerOptions?: Record<string, any>
      }
    }
  }
  ```
- **默认值**：未配置时不开启 lib 模式。

### 基础示例

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    lib: {
      entry: {
        button: 'components/button/index.vue',
        card: 'components/card/index.vue',
      },
      outDir: 'dist-lib',
      preservePath: true,
      componentJson: 'auto',
    },
  },
})
```

### 字段说明

- `entry`：必填。声明库入口，支持单入口、数组多入口和具名入口对象。
- `root`：库源码根目录，默认沿用 `weapp.srcRoot`。
- `outDir`：lib 产物输出目录，默认沿用 `build.outDir`。
- `preservePath`：是否保留源码相对路径。默认 `true`，适合组件库保持现有目录结构。
- `fileName`：自定义 JS 产物路径，不包含扩展名。适合把多入口统一映射成 `[name]/index` 之类的结构。
- `componentJson`：
  - `false`：不自动生成组件 JSON；
  - `true`：总是生成；
  - `'auto'`：仅在入口缺少 JSON 且看起来是组件入口时自动生成；
  - `function`：按入口动态返回 JSON 内容。

## `weapp.lib.dts` {#weapp-lib-dts}

- **默认值**：`true`
- **作用**：为 lib 入口生成 `d.ts`，尤其适合导出 `.vue` 组件时保留类型能力。

### 快速示例

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
      dts: {
        mode: 'vue-tsc',
        vueTsc: {
          compilerOptions: {
            declarationMap: true,
          },
        },
      },
    },
  },
})
```

### 选项说明

- `false`：关闭 DTS 生成。
- `true`：使用默认配置生成 DTS。
- `enabled`：显式控制是否输出类型文件。
- `mode`：
  - `internal`：默认模式，走内置方案，启动成本更低；
  - `vue-tsc`：交给 `vue-tsc` 生成，更贴近 Vue 生态工具链。
- `internal`：调整内置方案的 `tsconfig` / `compilerOptions` / `vueCompilerOptions`。
- `rolldown`：透传给 `rolldown-plugin-dts` 的附加配置，内置关键字段会被覆盖。
- `vueTsc`：当 `mode: 'vue-tsc'` 时，额外合并到临时 `tsconfig` 或传递对应编译参数。

## 常见组合

### 保留源码路径

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
      preservePath: true,
    },
  },
})
```

适合希望 `src/components/button/index.vue` 最终输出到 `dist/components/button/index.*` 的场景。

### 统一输出成 `[name]/index`

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: {
        button: 'components/button/index.vue',
        card: 'components/card/index.vue',
      },
      fileName: ({ name }) => `${name}/index`,
      preservePath: false,
    },
  },
})
```

适合把多个入口整理成更稳定的发布目录结构。

## 注意事项

- lib 模式同样会应用 [`weapp.chunks`](/config/chunks.md) 配置；多入口共享模块时是否生成 `common.js` 仍受 `sharedMode` 控制。
- 若你同时需要“本地调试 App”和“发布组件库”，推荐拆成两份配置文件：例如 `vite.config.ts` 负责调试，`weapp-vite.lib.config.ts` 负责发布。
- 若入口路径最终映射到同一个输出文件名，构建会报冲突错误；优先检查 `preservePath` 与 `fileName` 的组合。

## npm 发布建议

如果你的 lib 模式产物准备发布到 npm，并要求宿主项目自行安装 `wevu`：

- 将 `wevu` 声明到 `peerDependencies`
- 同时保留 `devDependencies.wevu`，用于本地调试、构建与类型检查
- 在 `build.rolldownOptions.external` 里显式 external 掉 `wevu` 与全部 `wevu/*` 子路径

```json
{
  "peerDependencies": {
    "wevu": "^6.10.2"
  },
  "devDependencies": {
    "wevu": "^6.10.2"
  }
}
```

```ts
export default defineConfig({
  weapp: {
    lib: {
      entry: ['components/button/index.vue'],
    },
  },
  build: {
    rolldownOptions: {
      external: [
        /^wevu(?:\/.*)?$/,
      ],
    },
  },
})
```

不建议只写 `external: ['wevu']`，因为这不能覆盖 `wevu/router`、`wevu/api`、`wevu/fetch` 等子路径导入。
