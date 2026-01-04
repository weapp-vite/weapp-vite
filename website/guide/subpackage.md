# 分包指南

微信小程序的分包机制在 `weapp-vite` 中得到完整支持。本页帮你快速搞清楚两件事：

- **普通分包 vs 独立分包** 有什么区别（哪些能互相引用、哪些不能）
- **weapp-vite 会怎么分发产物**（共享代码/依赖/样式会落到哪里）

如果你需要原理级配置（`weapp.subPackages`、`weapp.chunks` 等），请继续阅读 [配置文档 · 分包配置](/config/subpackages.md) 与 [配置文档 · Worker 配置](/config/worker.md)。

先记住 3 句话：

- **只想开启分包**：直接沿用官方 `app.json.subPackages` 写法即可，weapp-vite 会识别并按分包输出。
- **想共享主题/基础样式**：用 [`weapp.subPackages[].styles`](/config/subpackages.md#subpackages-styles) 交给构建器注入，别手写一堆相对路径 `@import`。
- **想控制共享代码怎么落盘**：关注 `weapp.chunks.sharedStrategy`（`duplicate` vs `hoist`）。

官方说明可参考：[分包加载 - 微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)。以下内容聚焦于 `weapp-vite` 的行为和调优手段。

::: tip 分包配置入口
通过 [`weapp.subPackages`](/config/subpackages.md#weapp-subpackages) 可以为每个 `root` 单独开启独立编译、裁剪 `dependencies` 或注入 `inlineConfig`。当需要强制开启独立分包、给特定分包设置额外的 `define`、或为某些分包关闭自动组件导入时，优先在 `vite.config.ts` 中调整该项。
:::

> [!NOTE]
> 文档里提到的 **Rolldown** 是 `weapp-vite` 内置的打包器：语法与 Vite/Rollup 插件体系兼容，但针对小程序做了额外的“分包产物分发”优化。你可以把它理解成「为小程序量身定制的 Rollup」；同一个 Rolldown 上下文意味着编译出的模块、样式和资源可以互相复用。

## 普通分包

普通分包会被视为和整个 `app` 是一个整体：主包 + 所有普通分包在**同一个 Rolldown 上下文**里构建，因此“共享/复制模块”这类优化是可行的。

微信运行时的限制（简化版）：

- `packageA` 不能直接 `require` `packageB` 的 JS，但可以引用主包与自身分包内的 JS。（使用“分包异步化”时此限制会放宽）
- `packageA` 不能引用 `packageB` 的模板（WXML），但可以引用主包与自身分包内的模板。
- `packageA` 不能直接使用 `packageB` 的静态资源，但可以使用主包与自身分包内的资源。

### 代码产物的位置

当一段可复用的 JS（例如 `utils`）被不同位置引用时，它最终会被输出到哪里，取决于“引用它的页面/组件”分布在哪里。下面用 `utils` 举例说明：

1. `utils` 只在 `packageA` 内被使用：产物只会出现在 `dist/packageA/` 内。
2. `utils` 同时在 `packageA` 和 `packageB` 内被使用：默认 `duplicate` 策略会把它复制到各分包的 `__shared__/common.js`，避免分包首开时再去拉主包；如果希望统一提炼到主包，请在 `vite.config.ts` 中设置 `weapp.chunks.sharedStrategy = 'hoist'`。
3. `utils` 同时在主包和 `packageA` 内被使用：`utils` 会被提炼到主包中，保证主包可以直接使用。

另外，`node_modules` 中的第三方依赖与 Vite 注入的 `commonjsHelpers.js` 也会参与相同的统计：在默认的 `duplicate` 策略下，它们会随着引用方复制到对应分包；只有在 `sharedStrategy: 'hoist'` 时，这些依赖才会统一落到主包的 `common.js`。

#### 详细示例

下面以 `test/fixtures/subpackage-dayjs` 为例，展示一次真实的分包拆分过程。项目结构与配置精简如下：

```text
src/
  app.ts
  utils/shared.ts                 # 主包与 packageA、packageB 同时引用
  packageA/
    pages/foo.ts                  # 引入 utils/shared.ts，并使用第三方 dayjs
  packageB/
    pages/bar.ts                  # 引入 utils/shared.ts，并使用第三方 dayjs
  workers/index.ts                # （可选）worker 入口

// vite.config.ts
export default defineConfig({
  weapp: {
    subPackages: [
      { root: 'packageA' },
      { root: 'packageB' },
    ],
    chunks: {
      sharedStrategy: 'duplicate',
    },
  },
})
```

构建完成后，测试夹具会分别生成 `dist-duplicate/` 与 `dist-hoist/` 两个目录，核心产物与模块来源对应关系如下：

| 产物位置                                                                                        | 说明                                                                                  |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `dist-duplicate/__weapp_shared__/packageA_packageB/common.js`                                   | `packageA` 与 `packageB` 共同引用的模块（如 `utils/shared.ts`），被标记为虚拟共享块。 |
| `dist-duplicate/packageA/__shared__/common.js`                                                  | 复制自虚拟共享块，供 `packageA` 使用。                                                |
| `dist-duplicate/packageB/__shared__/common.js`                                                  | 复制自虚拟共享块，供 `packageB` 使用。                                                |
| `dist-duplicate/packageA/pages/foo.js`                                                          | 入口被自动改写为 `require('../__shared__/common.js')`。                               |
| `dist-duplicate/packageB/pages/bar.js`                                                          | 入口被自动改写为 `require('../__shared__/common.js')`。                               |
| `dist-duplicate/packageA/__shared__/common.js` / `dist-duplicate/packageB/__shared__/common.js` | 内含 `dayjs` 等来自 `node_modules` 的依赖代码，因为它们仅被两个分包使用。             |
| `dist-hoist/common.js`                                                                          | 切换为 `hoist` 策略后，跨分包共享模块统一落在主包。                                   |
| `dist-hoist/packageA/pages/foo.js` / `dist-hoist/packageB/pages/bar.js`                         | 入口被改写为引用 `../common.js`。                                                     |
| `dist-hoist/app.js`                                                                             | 主包独享的逻辑，仍留在主包目录。                                                      |

若某个共享模块或 `node_modules` 依赖同样被主包引用，则它会被提炼到主包下的 `common.js`。将 `sharedStrategy` 切换为 `duplicate` 时，上述跨分包共享模块（包括 `dayjs` 等第三方依赖）会复制回各自分包的 `weapp-shared/common.js`，以换取更低的冷启动开销。位于某个分包目录下的源码如果被其它分包引用，构建器会直接报错，提示先把该模块移动到主包或公共目录，再进行跨分包共享。

<!--
### 使用 `take:` 强制随分包复制

如果只是少量公共逻辑想随某个分包打包，可以在导入语句前加上 `take:` 前缀，让分包显式“拿走”该模块：

```ts
// 位于 packageA 的页面
import { doSomething } from 'take:@/utils/shared'
```

- 只要分包内使用了 `import 'take:xxx'`，`xxx` 对应的 chunk 就会复制到该分包的 `weapp-shared/common.js` 中，即便全局共享策略是 `hoist`。
- 如果多个分包都以前缀 `take:` 引用同一模块，该模块会被复制到这些分包里，各自独立。
- 若某些入口继续通过普通 `import 'xxx'` 使用该模块，构建器会给出警告：代码会同时保留在主包 `common.js`，并额外复制到使用 `take:` 的分包中，便于你决定是否要把代码彻底迁移到主包或公共目录。
- `take:` 只影响产物落盘位置，不会改变模块语义、类型或 Tree-shaking 行为。
- 若要让 TypeScript 同步识别 `take:` 写法，可在 `tsconfig.json` 中补充：
  ```json
  {
    "compilerOptions": {
      "paths": {
        "@/*": ["src/*"],
        "take:@/*": ["src/*"]
      }
    }
  }
  ```
  这样 `import 'take:@/foo'` 会先映射回 `@/foo`，再继承原有别名配置；若需要为其它别名前缀启用 `take:`，按需在 `paths` 中追加对应映射即可。
-->

> 提示：主仓库的演示项目 `apps/vite-native` 也在 `packageA` 与 `packageC` 中引入了 `dayjs`，可以结合 `dist` 产物直观观察默认的 `duplicate` 策略与手动切换为 `hoist` 后的差异。

默认的 `duplicate` 策略可以在分包首次打开时避免回到主包拉取共享模块；若更在意控制整体包体、希望统一落到主包，也可以设置 `weapp.chunks.sharedStrategy = 'hoist'`，或结合 [advanced-chunks](https://rolldown.rs/guide/in-depth/advanced-chunks) 做更精细的拆分。

在实际项目中，跨分包共享逻辑往往会抽象到 `src/action/`、`src/services/` 等目录。若这些模块只被分包页面（或其它共享 chunk）间接引用，weapp-vite 会把位于根目录的“伪主包”导入者排除在统计之外，使共享代码仍然复制到各自的 `pages/*/weapp-shared/common.js`。例如下列最小复现：

```ts
// src/pages/index1/index.ts & src/pages/index3/index.ts
import { test1 } from '@/action/test1'

// src/action/test2.ts
import { test1 } from './test1'
```

在旧版本中，`test1` 会因为 `action/test2.ts` 的存在而被迫回退到主包 `common.js`。升级后构建日志会提示：

```
[subpackages] 分包 pages/index1、pages/index3 共享模块已复制到各自 weapp-shared/common.js（2 处引用，忽略主包引用：action/test2.ts）
```

如果扫描阶段拿不到完整的导入图，也可以通过 `weapp.chunks.forceDuplicatePatterns` 手动声明哪些目录始终视为可复制的共享库。

当复制出的共享模块越来越多时，也可以结合 `weapp.chunks.duplicateWarningBytes` 设定冗余体积的提醒阈值（默认约 `512 KB`），超过后构建日志会给出告警，便于提前关注包体膨胀。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      // 若项目更关注分包首屏性能，可以显式复制共享模块
      sharedStrategy: 'duplicate',
      // 强制忽略 action/ 下的导入方，防止伪主包引用拖回主包 common.js
      forceDuplicatePatterns: ['action/**'],
      // 调整冗余体积告警阈值
      duplicateWarningBytes: 768 * 1024,
    },
  },
})
```

## 独立分包

独立分包和整个 `app` 是隔离的：它们会在**不同的 Rolldown 上下文**里构建，因此不会和主包/其他分包共享复用的 JS 代码。

- **独立分包不能依赖主包和其他分包的内容**，包括 JS、模板、WXSS、自定义组件、插件等。（使用“分包异步化”时，JS/自定义组件/插件会放宽）
- 主包的 `app.wxss` 对独立分包无效：不要依赖主包全局样式。
- `App` 只能在主包里定义：独立分包里不要定义 `App()`，否则行为不可预期。
- 独立分包中暂时不支持使用插件。

### 单独开发某个分包（把它当成独立分包）

当你想“只专注开发某个分包”（例如一个业务域由独立小组交付、或希望尽量隔离主包依赖）时，推荐把该分包按 **独立分包** 的方式组织与编译：运行时隔离、构建时独立上下文、依赖/样式/组件策略也能只对这个分包生效。

1. 在 `app.json` 里把目标分包标记为 `independent: true`（并确保分包 `pages` 指向你要调试的页面）：

```jsonc
// src/app.json
{
  "pages": ["pages/index/index"],
  "subPackages": [
    {
      "root": "packages/order",
      "pages": ["pages/index", "pages/detail"],
      "independent": true,
      // 可选：分包级入口（基于 root 的相对路径），用于放分包初始化逻辑
      "entry": "index.ts"
    }
  ]
}
```

2. 在 `vite.config.ts` 里为该 `root` 配置 `weapp.subPackages`（关键是 `independent` + `dependencies`，其余按需）：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    subPackages: {
      'packages/order': {
        independent: true,
        inlineConfig: {
          // 在这里添加独立分包的大包配置
          define: {
            'import.meta.env.ORDER_DEV': JSON.stringify(true),
          },
        },
      },
    },
  },
})
```

> [!TIP]
> 如果你不想把“独立分包开发”的配置长期留在主配置里，可以单独新建一个 `vite.config.order.ts`，再用 `weapp-vite dev -c vite.config.order.ts` 运行；生产构建仍用默认的 `vite.config.ts`。

## 分包样式共享

[`weapp.subPackages[].styles`](/config/subpackages.md#subpackages-styles) 能把重复的 `@import` 交还给构建器处理：声明一次主题、设计令牌或基础布局，普通分包与独立分包都会在生成样式时自动插入对应的共享入口。

> [!TIP]
> 分包根目录下若存在 `index.*` / `pages.*` / `components.*`（默认扫描 `.wxss`/`.css`），weapp-vite 会自动识别它们作为共享入口，零配置即可复用。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    subPackages: {
      'packages/member': {
        // 普通分包：共享主题变量和页面级样式
        styles: [
          'styles/tokens.css',
          { source: 'styles/layout.wxss', scope: 'pages' },
        ],
      },
      'packages/offline': {
        independent: true,
        // 独立分包：会在独立上下文重新编译并注入 @import
        styles: [
          {
            source: 'styles/offline-theme.scss',
            include: ['pages/**/*.wxss', 'components/**/*.wxss'],
          },
        ],
      },
    },
  },
})
```

- 普通分包与主包共享 Rolldown 上下文，样式产物只生成一次，并在分包页面/组件头部自动注入 `@import`。
- 独立分包会在专属上下文重新编译同一份源文件，保持样式同步且无需手动维护相对路径。
- `scope` / `include` / `exclude` 可精准控制注入范围，配合 HMR 调试体验与主包一致。

更多细节（如产物位置与对象写法）可查看[配置文档 · 样式共享实战](/config/subpackages.md#subpackages-styles)。

### 调试建议

1. 确认 `app.json` 中的 `independent: true` 是否与 `vite.config.ts` 中的 `weapp.subPackages` 保持一致。
2. 利用 `weapp.debug.watchFiles` 查看产物位置，确认独立分包是否生成独立的 `miniprogram_npm`。
3. 如果分包引用到了主包路径，构建会报错提示，请及时调整引用方式或拆分公共模块。

### 分析产物布局

若要快速核对“哪些源码最终落到了主包 / 分包 / 共享 chunk”，可以在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "analyze": "weapp-vite analyze"
  }
}
```

然后执行：

```bash
pnpm run analyze
```

命令会读取当前 `vite.config.ts` 与 `app.json` 配置，进行一次只在内存写入的打包，并输出：

- 每个主包或分包包含的 chunk / 资源数量；
- 跨包复用、被复制到共享 chunk 的源码列表；
- `app.json` 中声明的分包及其 `independent` 状态。

需要与其他工具联动时，可以加上 `--json` 输出完整的 JSON 结果，或搭配 `--output <file>` 将结果写入磁盘：

```bash
pnpm run analyze -- --json --output report/analyze.json
```

写入文件时会自动创建缺失的目录，路径默认为相对项目根目录。JSON 中同时包含主包、各分包、虚拟共享 chunk 与源码映射的详细信息，可直接用于体积分析或预警脚本。

## 常见问题

- **本地运行时报路径错误？** 检查页面是否引用了其他分包的资源，或在 `weapp.chunks` 中启用了与你项目不符的策略。
- **产物体积过大？** 使用 `weapp.subPackages[].dependencies` 精确声明每个独立分包需要的 npm 依赖，剩余依赖保持在主包。
- **想在分包中调试 Worker？** 记得同时在 `weapp.worker` 中声明入口，并确保 Worker 文件位于对应分包目录。
