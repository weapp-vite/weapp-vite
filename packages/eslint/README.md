# @weapp-vite/eslint

`@weapp-vite/eslint` 提供 Wevu 兼容性和小程序 AppService 宿主 API 静态检查规则。

## 安装

```bash
pnpm add -D @weapp-vite/eslint eslint
```

## 配置

```js
import {
  miniProgramRuntimeRecommended,
  wevuCompatibilityPlugin,
  wevuCompatibilityRecommended,
} from '@weapp-vite/eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  miniProgramRuntimeRecommended,
  wevuCompatibilityRecommended,
  {
    plugins: {
      wevu: wevuCompatibilityPlugin,
    },
  },
])
```

推荐配置包含三条规则：

- `wevu/no-unsupported-api`：禁止静态可确定的不支持导入，并给出替代 API。
- `wevu/no-risky-api`：警告同名但参数、时序或宿主语义不同的 API。
- `wevu/no-unsupported-template-feature`：只对能追溯到 `vue-router` 导入的 `RouterLink` 模板能力报错。

`miniProgramRuntimeRecommended` 另外提供：

- `mini-program/no-unsupported-runtime-api`：禁止 DOM/Node 全局和超出 ES2018 小程序兼容基线的现代内建。
- `mini-program/no-implicit-runtime-polyfill`：警告 `queueMicrotask`、`fetch`、`URL`、`AbortController` 等不能依赖宿主隐式提供的能力，并指向 `weapp.appPrelude.webRuntime` 或显式兼容层。

默认只匹配 `src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}`，排除 config、测试、脚本、Web-only、`dist` 和生成目录。需要自定义源码范围时使用：

```js
import { createMiniProgramRuntimeConfig } from '@weapp-vite/eslint'

export default defineConfig([
  createMiniProgramRuntimeConfig({ files: ['app/**/*.ts'] }),
])
```

局部变量、参数、import、类型位置和单纯的 `typeof` 能力探测不会报错。静态规则不能代替目标真机/IDE 验证；尤其不能假定所有微信基础库都提供 `queueMicrotask`。

规则只检查项目源码，不扫描 `node_modules`、构建产物或 `.weapp-vite` 生成文件。动态属性访问、第三方依赖内部代码和宿主运行时能力不在静态判定范围内。

兼容矩阵也从根入口导出：

```ts
import {
  findWevuCompatibilityEntry,
  wevuCompatibilityCatalog,
} from '@weapp-vite/eslint'
```

旧项目可以继续从 `weapp-vite/eslint` 和 `weapp-vite/compatibility` 导入兼容转出入口。
