# 分包加载

分包的使用方式和微信小程序的方式完全相同

[分包加载-微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)

值得注意的是，`普通分包` 和 `独立分包` 在 `weapp-vite` 中的处理方式是不同的

::: tip 分包配置入口
通过 [`weapp.subPackages`](/config/subpackages-and-worker#weapp-subpackages) 可以为每个 `root` 单独开启独立编译、裁剪 `dependencies` 或注入 `inlineConfig`。当需要强制开启独立分包、给特定分包设置额外的 `define`、或为某些分包关闭自动组件导入时，优先在 `vite.config.ts` 中调整该项。
:::

## 普通分包

普通分包被视为和整个 `app` 是一个整体，所以它们是在一个 `Rolldown` 上下文里面进行打包的

根据引用规则:

- `packageA` 无法 `require` `packageB` `JS` 文件，但可以 `require` 主包、`packageA` 内的 `JS` 文件；使用 `分包异步化` 时不受此条限制
- `packageA` 无法 `import` `packageB` 的 `template`，但可以 `require` 主包、`packageA` 内的 `template`
- `packageA` 无法使用 `packageB` 的资源，但可以使用主包、`packageA` 内的资源

### 代码产物的位置

所以假如有可以复用的 `js` 代码，它们产物的位置，取决于它们被引入使用的文件位置，这里我们以工具类 `utils` 为例，展示处理策略上的区别

1. 假如 `utils` 只被 `packageA` 中的文件使用，那么 `utils` 的产物只会出现在 `dist` 产物的 `packageA` 中。
2. 假如 `utils` 在 `packageA` 和 `packageB` 中使用，那么 `utils` 会被复制到各自分包的 `__shared__/common.js` 中，而不再提炼到主包。
3. 假如 `utils` 在 `packageA` 和主包中使用，那么 `utils` 的产物会被提炼到主包中，保证主包可以直接使用。

另外，`node_modules` 中的第三方依赖与 Vite 注入的 `commonjsHelpers.js` 也会参与相同的统计：在默认的 `duplicate` 策略下，它们会和业务模块一起根据引用方被复制到各自分包；只有在 `sharedStrategy: 'hoist'` 时，相关模块才会统一落到主包的 `common.js`，供所有分包共享。

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

若某个共享模块或 `node_modules` 依赖同样被主包引用，则它会被提炼到主包下的 `common.js`。将 `sharedStrategy` 切换为 `hoist` 时，上述跨分包共享模块（包括 `dayjs` 等第三方依赖）会集中在主包的 `common.js`，供所有分包按需引用。

> 提示：主仓库的演示项目 `apps/vite-native` 也在 `packageA` 与 `packageC` 中引入了 `dayjs`，可以结合 `dist` 产物直观观察默认策略与 `hoist` 策略的差异。

默认的复制策略可以显著降低跨分包访问主包代码时的冷启动成本，当然你也可以通过 `weapp.chunks.sharedStrategy = 'hoist'` 恢复旧行为，或结合 [advanced-chunks](https://rolldown.rs/guide/in-depth/advanced-chunks) 功能进行更精细的拆分。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      // 若项目体积更敏感，也可以显式切回旧策略
      sharedStrategy: 'hoist',
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
