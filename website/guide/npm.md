# npm 自动构建

目前 `weapp-vite` 中内置了 `2` 种 `npm` 自动构建的策略与 `1` 种手动构建的策略:

::: tip 配置速记
若需要关闭自动打包、切换缓存策略或为特定依赖覆写 Vite 库模式的构建选项，请在 `vite.config.ts` 中调整 [`weapp.npm`](/config/npm.md#weapp-npm)。
:::

## 自动构建

1. `weapp-vite` 自动构建 `miniprogram_npm`
2. `weapp-vite` 自动内联代码到特定的 `js` 产物中

### 1. 自动构建 `miniprogram_npm`

在 `package.json` 中 `dependencies` 字段里注册的依赖，会在每次构建运行的时候，被打包工具打包成小程序可以接受的格式，然后输出到 `project.config.json` 里注册的 `miniprogramNpmDistDir` 目录的 `miniprogram_npm` 中去

### 2. 自动内联代码到对应的 `js` 产物中

没有在 `package.json` 中 `dependencies` 字段里注册的依赖，比如注册在 `devDependencies` 里的依赖，或者 `monorepo` 里更高层级的依赖，在代码里引入了之后，会被自动转化成内联代码，整个放入你的 `js` 产物中

### 详细解释

我们来看这样一个案例，有下方一个 `package.json`:

```json
{
  "dependencies": {
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "lodash-es": "^4.17.21"
  }
}
```

其中 `lodash` 注册在 `dependencies` 里，`lodash-es` 注册在 `devDependencies` 里。把它们分别引入页面后，weapp-vite 会采用不同的打包策略：

- **`dependencies` → 构建 `miniprogram_npm`**：产物保留 `require('lodash')`，依赖会被同步到 `miniprogram_npm`，保持最小化的页面代码。
  ```js
  const lodash = require('lodash')
  Page({
    data: {
      num0: lodash.add(1, 1),
    },
  })
  ```
- **`devDependencies` → 内联到页面脚本**：开发依赖会在构建时转成普通 JavaScript，并直接合并进页面入口，避免额外的 npm 目录。
  ```js
  var add = /* lodash-es add 的实现主体 */
  Page({
    data: {
      num1: add(2, 2),
    },
  })
  ```

> [!TIP]
> 实际的内联代码会比示例长得多（包含类型检查、数值转换等工具函数），但你无需手动维护它们。只要合理放置 `dependencies` 与 `devDependencies`，weapp-vite 会自动选择「生成 `miniprogram_npm`」还是「直接内联」的最佳方案。

具体使用什么自动构建方案，取决于你的选择。

## 手动构建

执行命令 `weapp-vite npm` , 会调用 `微信开发者工具` -> `工具` -> 构建 `npm` 的功能，来手动构建 `miniprogram_npm`。

这相当于你在 `微信开发者工具` 里手动点了一遍 `工具` -> 构建 `npm` 功能。

> `weapp-vite npm` 别名 `weapp-vite build:npm` / `weapp-vite build-npm`
