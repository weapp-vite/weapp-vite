---
title: npm 自动构建
description: weapp-vite 会尽量帮你把“npm 依赖怎么进小程序”这件事自动化：默认提供 **2 种自动策略**，以及 **1 个手动触发**命令。
keywords:
  - 微信小程序
  - guide
  - npm
  - 自动构建
  - weapp-vite
  - 会尽量帮你把“npm
  - 依赖怎么进小程序”这件事自动化：默认提供
  - "2"
---

# npm 自动构建

`weapp-vite` 会尽量帮你把“npm 依赖怎么进小程序”这件事自动化：默认提供 **2 种自动策略**，以及 **1 个手动触发**命令。

::: tip 配置速记
若需要关闭自动打包、切换缓存策略或为特定依赖覆写 Vite 库模式的构建选项，请在 `vite.config.ts` 中调整 [`weapp.npm`](/config/npm.md#weapp-npm)。
:::

## 自动构建

自动构建时会发生两类事情（你不需要手动二选一，框架会按规则处理）：

1. **把依赖构建到 `miniprogram_npm`**（适合保留 `require('xxx')` 的形式）
2. **把依赖内联进页面/组件脚本**（适合减少 npm 目录或处理非运行时依赖）

### 1. 构建到 `miniprogram_npm`（来自 `dependencies`）

你在 `package.json.dependencies` 里声明的依赖，会在构建时被打包成小程序可用的格式，并输出到 `project.config.json` 的 `miniprogramNpmDistDir` 目录下（也就是 `miniprogram_npm/`）。

### 2. 内联到脚本产物（不在 `dependencies` 的依赖）

没有出现在 `package.json.dependencies` 里的依赖（例如写在 `devDependencies`、或来自 monorepo 更上层的依赖），在被 `import`/`require` 后会被构建器打包并**内联**到对应的页面/组件脚本里。

### 详细解释

看一个最常见的例子：

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

其中 `lodash` 在 `dependencies`，`lodash-es` 在 `devDependencies`。在页面里分别引入它们时，weapp-vite 的处理方式不同：

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
> 实际内联出来的代码会比示例长得多（可能包含工具函数等），但你不需要手动维护。只要把依赖放在合适的字段里，weapp-vite 会自动选择“进 `miniprogram_npm`”还是“直接内联”。

### 怎么选（建议）

- **运行时确实要用、并且希望复用的库**：放进 `dependencies`，让它进 `miniprogram_npm`。
- **仅开发/构建期使用的工具**：放进 `devDependencies`。
- **想减少 `miniprogram_npm`，接受包体变大**：也可以把运行时依赖放到非 `dependencies`，让它被内联（不推荐作为默认策略）。

## 手动构建

执行命令 `weapp-vite npm` 会调用「微信开发者工具 → 工具 → 构建 npm」，手动构建 `miniprogram_npm`。

这相当于你在开发者工具里手动点了一遍“构建 npm”。

> `weapp-vite npm` 别名 `weapp-vite build:npm` / `weapp-vite build-npm`
