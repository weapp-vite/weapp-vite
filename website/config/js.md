---
title: JS 配置
description: Weapp-vite 读取 tsconfig.json/jsconfig.json 的继承配置和路径别名，并支持 Vite 原生解析及高级项目发现选项。
keywords:
  - 配置
  - config
  - js
  - Weapp-vite
  - 内置集成了
  - resolve.tsconfigPaths
  - 用于读取
---

# JS 配置 {#js-config}

`weapp-vite` 默认读取 `tsconfig.json/jsconfig.json` 的 `paths/baseUrl` 并生成 Vite / Rolldown 别名。传入 `true` 可启用 Vite 8 原生的 `resolve.tsconfigPaths`；传入高级选项对象时启用 `vite-tsconfig-paths` 插件。JSON / JSONC 的 `usingComponents` 不会默认继承 `paths`，需要别名时请显式配置 `weapp.jsonAlias`。

[[toc]]

## `weapp.tsconfigPaths` {#weapp-tsconfigpaths}
- **类型**：`true | TsconfigPathsOptions | false`
- **默认值**：`undefined`（按需自动启用）

启用规则：
- 默认自动检查根配置、继承配置和项目引用，将可表示为前缀的路径映射加入别名；
- 传入 `true` 时，会强制启用原生 `resolve.tsconfigPaths`；
- 传入对象时，会启用 `vite-tsconfig-paths` 插件以支持 `projects`、`skip`、`importerFilter` 等高级选项；
- 传入 `false` 禁用原生解析和高级插件；已提取的简单别名及显式 `resolve.alias` 仍保留。

推荐优先使用默认行为或 `true`，这样不会触发 Vite 8 对 `vite-tsconfig-paths` 的提示信息。

继承支持相对路径、包配置及 `extends` 数组，数组后项覆盖前项。子配置的 `compilerOptions.paths` 替换父配置的整个映射，不逐项合并；继承路径按其配置来源和有效 `baseUrl` 解析。更复杂的通配映射请使用 `true` 或高级选项对象。

高级适配精确固定为 `vite-tsconfig-paths@7.0.0-alpha.3`（预发行版），移除了只声明支持 TypeScript 5 的 `tsconfck` 依赖。旧 `parseNative` 配置仍可通过框架类型检查，但已弃用：统一解析器处理继承与路径，该选项不再切换为 TypeScript 编译器解析。消费端不需要忽略 peer 校验或自行覆盖间接依赖。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    tsconfigPaths: true,
  },
})
```

```ts
import { defineConfig } from 'weapp-vite/config'
import type { WeappViteConfig } from 'weapp-vite/config'

const tsconfigOptions: Exclude<WeappViteConfig['tsconfigPaths'], boolean | undefined> = {
  projects: ['./tsconfig.base.json'],
  loose: true,
  projectDiscovery: 'lazy',
}

export default defineConfig({
  weapp: {
    tsconfigPaths: tsconfigOptions,
  },
})
```

### 与 `resolve.alias` 的关系

- `weapp.tsconfigPaths` / `resolve.tsconfigPaths` 负责把 **tsconfig 的 paths/baseUrl** 转成 Vite alias。
- JSON / JSONC 的 `usingComponents` 不会默认继承 `compilerOptions.paths`；需要别名时请显式配置 `weapp.jsonAlias`。
- 你仍然可以在 `resolve.alias` 中补充或覆盖特定映射，两者可共存。

```ts
export default defineConfig({
  resolve: {
    alias: {
      '@shared': '/packages/shared/src',
    },
  },
  weapp: {
    tsconfigPaths: {
      projects: ['./tsconfig.base.json'],
    },
  },
})
```

### 常见问题

- **修改 `paths` 没生效？** 需要重启 `pnpm dev`，并确认 tsconfig 在 `projects` 列表内。
- **JSON 别名怎么配？** JSON 别名需要显式配置 `weapp.jsonAlias`；它不会默认继承 `compilerOptions.paths`（见 [JSON 配置](/config/json.md#weapp-jsonalias)）。

## `weapp.ast` {#weapp-ast}
- **类型**：`{ engine?: 'babel' | 'oxc' }`
- **默认值**：`{ engine: 'babel' }`

`weapp.ast` 用来控制部分“静态分析链路”优先使用哪套 AST 引擎，例如：

- 组件 props 元数据提取
- `usingComponents` / 自动导入相关分析
- `setData.pick` 模板 key 收集
- 一部分平台 API / require 快速判定

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    ast: {
      engine: 'oxc',
    },
  },
})
```

使用建议：
- 默认保持 `babel` 即可，兼容性最稳。
- 当你明确想在“分析链路”上尝试更快的解析实现时，再切到 `oxc`。
- 这不是“所有编译流程全部切换引擎”的总开关，而是给已接入 AST 抽象层的分析能力提供统一入口。

---

更多 alias 实战与疑难排查，请参考 [路径别名指南](/guide/alias)。
