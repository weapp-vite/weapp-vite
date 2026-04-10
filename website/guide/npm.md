---
title: npm 自动构建
description: Weapp-vite 会尽量帮你把“npm 依赖怎么进小程序”这件事自动化：默认提供 **2 种自动策略**，以及 **1 个手动触发**命令。
keywords:
  - 微信小程序
  - guide
  - npm
  - 自动构建
  - Weapp-vite
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

### 1. 构建到 `miniprogram_npm`（明确的小程序包 / 显式指定的包）

以下依赖会优先进入 npm 构建：

- 包自身就是小程序包，例如 `tdesign-miniprogram`、`@vant/weapp`
- 你在 `weapp.npm.include`、`mainPackage.dependencies`、`pluginPackage.dependencies`、`subPackages.<root>.dependencies` 里显式指定的包

这些依赖会输出到 `project.config.json` 的 `miniprogramNpmDistDir` 目录下（也就是 `miniprogram_npm/`）。

### 2. 内联到脚本产物（默认行为）

没有命中 npm 构建规则的依赖，不管它写在 `dependencies` 还是 `devDependencies`，在被 `import`/`require` 后都会被构建器打包并**内联**到对应的页面/组件脚本里。

### 详细解释

看一个最常见的例子：

```json
{
  "dependencies": {
    "lodash": "^4.17.21",
    "tdesign-miniprogram": "^1.12.3"
  },
  "devDependencies": {
    "lodash-es": "^4.17.21",
    "@vant/weapp": "^1.11.6"
  }
}
```

其中：

- `lodash`、`lodash-es` 都会默认内联进页面脚本
- `tdesign-miniprogram`、`@vant/weapp` 会默认进入 `miniprogram_npm`

在页面里分别引入它们时，Weapp-vite 的处理方式大致如下：

- **普通依赖 → 内联到页面脚本**：构建期会转成普通 JavaScript，并直接合并进页面入口，避免额外的 npm 目录。
  ```js
  var add = /* lodash add 的实现主体 */
  Page({
    data: {
      num0: add(1, 1),
    },
  })
  ```
- **小程序包 → 构建 `miniprogram_npm`**：产物保留包路径引用，依赖会被同步到 `miniprogram_npm`。
  ```js
  const button = require('tdesign-miniprogram/button/button')
  Page({
    components: { button },
  })
  ```

> [!TIP]
> 实际内联出来的代码会比示例长得多（可能包含工具函数等），但你不需要手动维护。默认情况下，Weapp-vite 会优先把依赖当普通包处理；只有明确的小程序包或你显式指定的包，才会进 `miniprogram_npm`。

### 怎么选（建议）

- **普通运行时库**：照常放进 `dependencies` 或 `devDependencies`，默认都会被 Vite 内联。
- **明确的小程序组件库**：直接安装即可，默认会进 `miniprogram_npm`。
- **想让普通依赖也进入 `miniprogram_npm`**：用 `weapp.npm.include` 或包级 `dependencies` 配置显式声明。
- **仅开发/构建期使用的工具**：放进 `devDependencies`。
- **想恢复旧规则**：把 `weapp.npm.strategy` 设成 `'legacy'`。

## 手动构建

执行命令 `wv npm` 会调用「微信开发者工具 → 工具 → 构建 npm」，手动构建 `miniprogram_npm`。

这相当于你在开发者工具里手动点了一遍“构建 npm”。

> `wv npm` 别名 `wv build:npm` / `wv build-npm`
