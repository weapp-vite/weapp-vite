# 分包指南

WeChat 小程序的分包机制在 `weapp-vite` 中得到完整支持。本页帮助你快速理解「普通分包 vs 独立分包」的差异，以及框架在构建阶段做了哪些工作。若需要原理级配置（`weapp.subPackages`、`weapp.chunks` 等），请继续阅读 [配置文档 · 分包与 Worker 策略](/config/subpackages-and-worker.md)。

- 想知道如何开启分包？直接沿用官方 `app.json` 写法即可。
- 想共用工具、样式？使用 [`weapp.subPackages[].styles`](/config/subpackages-and-worker.md#styles-in-action) 即可在普通与独立分包之间共享主题、变量与基础样式。
- 想优化构建产物位置？留意 `weapp.chunks.sharedStrategy`。

官方说明可参考：[分包加载 - 微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)。以下内容聚焦于 `weapp-vite` 的行为和调优手段。

::: tip 分包配置入口
通过 [`weapp.subPackages`](/config/subpackages-and-worker#weapp-subpackages) 可以为每个 `root` 单独开启独立编译、裁剪 `dependencies` 或注入 `inlineConfig`。当需要强制开启独立分包、给特定分包设置额外的 `define`、或为某些分包关闭自动组件导入时，优先在 `vite.config.ts` 中调整该项。
:::

> [!NOTE]
> 文档多次提到的 **Rolldown** 是 `weapp-vite` 内置的打包器，语法与 Vite/Rollup 插件体系兼容，但针对小程序做了额外的产物分发优化。你可以把它理解成「为小程序量身定制的 Rollup」，同一个 Rolldown 上下文意味着编译出的模块、样式和资源可以直接互相复用。

## 普通分包

普通分包被视为和整个 `app` 是一个整体，所以它们是在同一个 Rolldown 上下文里面进行打包的。

根据引用规则:

- `packageA` 无法 `require` `packageB` `JS` 文件，但可以 `require` 主包、`packageA` 内的 `JS` 文件；使用 `分包异步化` 时不受此条限制
- `packageA` 无法 `import` `packageB` 的 `template`，但可以 `require` 主包、`packageA` 内的 `template`
- `packageA` 无法使用 `packageB` 的资源，但可以使用主包、`packageA` 内的资源

### 代码产物的位置

所以假如有可以复用的 `js` 代码，它们产物的位置，取决于它们被引入使用的文件位置，这里我们以工具类 `utils` 为例，展示处理策略上的区别

1. 假如 `utils` 只被 `packageA` 中的文件使用，那么 `utils` 的产物只会出现在 `dist` 产物的 `packageA` 中。
2. 假如 `utils` 在 `packageA` 和 `packageB` 中使用，那么在默认的 `hoist` 策略下它会被统一提炼到主包 `common.js`，供所有分包共享；如果希望依旧复制到分包，请在 `vite.config.ts` 中设置 `weapp.chunks.sharedStrategy = 'duplicate'`。反之，只要把共享源码本身放在某个分包目录下，它就会跟着该分包落盘，其它分包想复用时需要先把源码上移到主包或公共目录。
3. 假如 `utils` 在 `packageA` 和主包中使用，那么 `utils` 的产物会被提炼到主包中，保证主包可以直接使用。

另外，`node_modules` 中的第三方依赖与 Vite 注入的 `commonjsHelpers.js` 也会参与相同的统计：在默认的 `hoist` 策略下，它们会统一落到主包的 `common.js`；只有在 `sharedStrategy: 'duplicate'` 时，这些依赖才会和业务模块一起根据引用方被复制到各自分包。

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
### 使用 `?take` 强制随分包复制

如果只是少量公共逻辑想随某个分包打包，可以在导入语句后追加 `?take`，让分包显式“拿走”该模块：

```ts
// 位于 packageA 的页面
import { doSomething } from '@/utils/shared?take'
```

- 只要分包内使用了 `import 'xxx?take'`，`xxx` 对应的 chunk 就会复制到该分包的 `weapp-shared/common.js` 中，即便全局共享策略是 `hoist`。
- 如果多个分包都以 `?take` 引用同一模块，该模块会被复制到这些分包里，各自独立。
- 若某些入口继续通过普通 `import 'xxx'` 使用该模块，构建器会给出警告：代码会同时保留在主包 `common.js`，并额外复制到使用 `?take` 的分包中，便于你决定是否要把代码彻底迁移到主包或公共目录。
- `?take` 只影响产物落盘位置，不会改变模块语义、类型或 Tree-shaking 行为。
- 若要让 TypeScript 也识别 `?take` 写法，推荐在 `tsconfig.json` 中设置 `"moduleSuffixes": ["?take", ""]`，这样 `import 'foo?take'` 会自动映射回 `foo` 的类型声明。
-->

> 提示：主仓库的演示项目 `apps/vite-native` 也在 `packageA` 与 `packageC` 中引入了 `dayjs`，可以结合 `dist` 产物直观观察默认策略与 `hoist` 策略的差异。

默认的 `hoist` 策略可以最大化复用与减小包体，但如果更在意跨分包访问主包代码时的冷启动成本，依旧可以通过 `weapp.chunks.sharedStrategy = 'duplicate'` 复制一份共享模块，或结合 [advanced-chunks](https://rolldown.rs/guide/in-depth/advanced-chunks) 功能进行更精细的拆分。

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

独立分包和整个 `app` 是隔离的，所以它们是在不同的 Rolldown 上下文里面进行打包的，它们是不会去共享复用的 `js` 代码的

- **独立分包中不能依赖主包和其他分包中的内容**，包括 `js` 文件、`template`、`wxss`、自定义组件、插件等（使用 `分包异步化` 时 js 文件、自定义组件、插件不受此条限制）
- 主包中的 `app.wxss` 对独立分包无效，应避免在独立分包页面中使用 `app.wxss` 中的样式；
  `App` 只能在主包内定义，独立分包中不能定义 `App`，会造成无法预期的行为；
- 独立分包中暂时不支持使用插件。

## 分包样式共享

[`weapp.subPackages[].styles`](/config/subpackages-and-worker.md#styles-in-action) 能把重复的 `@import` 交还给构建器处理：声明一次主题、设计令牌或基础布局，普通分包与独立分包都会在生成样式时自动插入对应的共享入口。

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

更多细节（如产物位置与对象写法）可查看[配置文档 · 样式共享实战](/config/subpackages-and-worker.md#styles-in-action)。

### 调试建议

1. 确认 `app.json` 中的 `independent: true` 是否与 `vite.config.ts` 中的 `weapp.subPackages` 保持一致。
2. 利用 `weapp.debug.watchFiles` 查看产物位置，确认独立分包是否生成独立的 `miniprogram_npm`。
3. 如果分包引用到了主包路径，构建会报错提示，请及时调整引用方式或拆分公共模块。

### 使用 CLI 快速分析产物

如果希望快速核对“哪些源码最终落到了主包 / 分包 / 共享 chunk”，可以使用内置的 `weapp-vite analyze` 命令：

```bash
# 在项目根目录执行
pnpm weapp-vite analyze
```

命令会读取当前 `vite.config.ts` 与 `app.json` 配置，进行一次只在内存写入的打包，并输出：

- 每个主包或分包包含的 chunk / 资源数量；
- 跨包复用、被复制到共享 chunk 的源码列表；
- `app.json` 中声明的分包及其 `independent` 状态。

需要与其他工具联动时，可以加上 `--json` 输出完整的 JSON 结果，或搭配 `--output <file>` 将结果写入磁盘：

```bash
# 将结果保存为 report/analyze.json
pnpm weapp-vite analyze --json --output report/analyze.json
```

写入文件时会自动创建缺失的目录，路径默认为相对项目根目录。JSON 中同时包含主包、各分包、虚拟共享 chunk 与源码映射的详细信息，可直接用于体积分析或预警脚本。

## 常见问题

- **本地运行时报路径错误？** 检查页面是否引用了其他分包的资源，或在 `weapp.chunks` 中启用了与你项目不符的策略。
- **产物体积过大？** 使用 `weapp.subPackages[].dependencies` 精确声明每个独立分包需要的 npm 依赖，剩余依赖保持在主包。
- **想在分包中调试 Worker？** 记得同时在 `weapp.worker` 中声明入口，并确保 Worker 文件位于对应分包目录。
