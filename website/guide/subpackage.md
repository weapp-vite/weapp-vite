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
