# Wxss 样式增强与注意点

## Wxss 样式增强

`weapp-vite` 中使用 `vite` 来处理样式，所以一个打包入口 `js` 文件中会默认引入它下面的所以样式，并按照一定的顺序进行排列:

```ts
/**
 * 源代码支持的 css 文件格式
 */
export const supportedCssLangs = ['wxss', 'css', 'scss', 'less', 'sass', 'styl']
```

所以 `pages/index/index.js` 中引入的样式会按照以下顺序进行打包:

```js
import './pages/index/index.wxss' // wxss
import './pages/index/index.css' // css
import './pages/index/index.scss' // scss
import './pages/index/index.less' // less
import './pages/index/index.sass' // sass
import './pages/index/index.styl' // styl
```

其他样式预编译器，取决于是否安装对应的语言，比如 `scss` 需要安装 `sass`，`less` 需要安装 `less`，`styl` 需要安装 `stylus`。

## Wxss 引入资源的注意点

### vite 样式加载默认行为

在 `weapp-vite` 中，由于使用 `vite` 来处理样式，所以在 `wxss` 中引入资源时，会自动进行解析和 `resolve`

比如 `scss` 中进行资源引入, `sass` 在进行编译的时候，它的编译结果就会直接把 `index.scss` 的内容引入到这个文件中输出出来。

::: code-group

```scss [input.scss]
@import './index.scss';
.box {
  background: pink;
}
```

```css [output.wxss]
/* from index.scss */
.index {
  background: pink;
}
.box {
  background: pink;
}
```

:::

> 此处不能在 scss 中直接引入 wxss，因为 scss 并不认识这个扩展名，如果需要强行引入，需要更改其中的 scss resolver 配置

又比如在 `css` 中使用 `@import` 引入资源时，同样 `vite` 内置的插件 `postcss-import` 插件会把 `@import` 的内容引入到这个文件中输出出来。

::: code-group

```css [input.css]
@import './index.css';
.box {
  background: pink;
}
```

```css [output.wxss]
/* from index.css */
.index {
  background: pink;
}
.box {
  background: pink;
}
```

:::

> 同样不认识 wxss 扩展名

### 这种默认行为在小程序中的问题

这种行为在 `h5` 中很合理，但是在小程序中不是，因为小程序时直接支持使用 `@import` 的。

我们不希望 `@import` 语句被默认的 `resolve` 变成一堆 `inline` 的样式代码。

所以这种时候 `weapp-vite` 中开了一个口子:

比如 `tdesign` 的深色模式一定要使用 `@import` 来引入一些 `wxss` 文件，默认使用

```css
@import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
```

来进行加载，此时需要把这个代码更改为

```diff
- @import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
+ @wv-keep-import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
```

也就是把 `@import` 改为 `@wv-keep-import`，这样就不会被 `vite` 进行处理了。

### `@wv-keep-import`

`@wv-keep-import` 这个语法是 `weapp-vite` 中的一个自定义语法，主要是为了让 `vite` 在处理样式的时候，保留 `@import` 的原始引入，从而跳过 `vite` 的处理。

在命名上 `wv` 对应 `weapp-vite`，`keep-import` 的意思就是保留 `import` 的原始引入。

使用 `@wv-keep-import` 能够把 `@import` 的内容保留在产物的 `wxss` 中，然后交给微信开发者工具，自己去进行解析。

```css
/* 输入 */
@wv-keep-import './style/theme/_index.wxss';
/* 输出 */
@import './style/theme/_index.wxss';
```
