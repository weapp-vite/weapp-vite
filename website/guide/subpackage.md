# 分包加载

分包的使用方式和微信小程序的方式完全相同

[分包加载-微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages.html)

值得注意的是，`普通分包` 和 `独立分包` 在 `weapp-vite` 中的处理方式是不同的

## 普通分包

普通分包被视为和整个 `app` 是一个整体，所以它们是在一个 `rollup` 上下文里面进行打包的

根据引用规则:

- `packageA` 无法 `require` `packageB` `JS` 文件，但可以 `require` 主包、`packageA` 内的 `JS` 文件；使用 `分包异步化` 时不受此条限制
- `packageA` 无法 `import` `packageB` 的 `template`，但可以 `require` 主包、`packageA` 内的 `template`
- `packageA` 无法使用 `packageB` 的资源，但可以使用主包、`packageA` 内的资源

所以假如有可以复用的 `js` 代码，会被提炼到主包里

## 独立分包

独立分包和整个 `app` 是隔离的，所以它们是在不同的上下文里面进行打包的，它们是不会去共享复用的 `js` 代码的

- **独立分包中不能依赖主包和其他分包中的内容**，包括 `js` 文件、`template`、`wxss`、自定义组件、插件等（使用 `分包异步化` 时 js 文件、自定义组件、插件不受此条限制）
- 主包中的 `app.wxss` 对独立分包无效，应避免在独立分包页面中使用 `app.wxss` 中的样式；
  `App` 只能在主包内定义，独立分包中不能定义 `App`，会造成无法预期的行为；
- 独立分包中暂时不支持使用插件。
