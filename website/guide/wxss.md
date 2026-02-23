# WXSS 样式增强与注意点

`weapp-vite` 继承了 Vite 的样式处理能力：支持 `.wxss`、`.css`、`.scss`、`.less`、`.sass`、`.styl` 等格式，并输出为小程序可识别的 WXSS。

本页主要讲两件事：

1. weapp-vite 会怎么收集/编译同名样式文件
2. 小程序场景里为什么有些 `@import` 不能被“提前内联”，以及怎么处理

## 支持的样式格式

入口脚本（如 `pages/index/index.ts`）在构建时会按固定顺序注入同名样式文件：

```ts
import './pages/index/index.wxss'
import './pages/index/index.css'
import './pages/index/index.scss'
import './pages/index/index.less'
import './pages/index/index.sass'
import './pages/index/index.styl'
```

只要安装了对应的预处理器依赖（`sass`、`less`、`stylus`），上述文件都会被 Rolldown 处理并转换成 WXSS。

## Vite 的默认行为

在 Web 项目中，Vite 会解析样式里的 `@import`、`url()` 等语句，在构建阶段将其“内联”成一份完整的样式。这在小程序项目里同样适用：

```scss
/* input.scss */
@import './base.scss';
.box {
  background: pink;
}
```

```css
/* output.wxss */
/* from base.scss */
.base {
  background: pink;
}
.box {
  background: pink;
}
```

> [!NOTE]
> 预处理器通常不会识别 `.wxss` 扩展名。如果需要在 SCSS 中引用 `.wxss` 文件，需要额外配置 resolver，或使用同名的 `.scss` 文件。

## 小程序场景下的差异

小程序原生支持 `@import`，由运行时解析路径并加载对应文件。部分生态（如 TDesign 的主题切换）依赖这种机制，如果被 Vite 内联，就会破坏原有逻辑。

为此 weapp-vite 提供了一个自定义指令 `@wv-keep-import`，用于跳过 Vite 的内联处理：

```diff
- @import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
+ @wv-keep-import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
```

编译后会恢复为原生写法：

```css
@import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss';
```

这样微信开发者工具就能在运行时继续处理该依赖。

### 何时使用 `@wv-keep-import`

- 需要把 `@import` 原封不动交给小程序运行时。
- 引用路径指向 `miniprogram_npm`、分包或其他构建后目录。
- 希望在 WXSS 里保留官方语法（尤其是 `_index.wxss`、`theme` 等主题相关文件）。

对于普通的样式拆分，仍建议使用默认的 `@import` 或 `@use`，让构建器提前合并，提升首屏效率。

## 资源引用与公共样式

- 使用 `@/`、`./` 等路径导入图片时，Rolldown 会自动复制并生成正确的产物路径。
- 若资源位于 `public/`，请改用绝对路径 `/icons/logo.png`，该目录会被原样复制。
- 可结合 [`weapp.subPackages[].styles`](/config/subpackages.md#subpackages-styles) 在普通或独立分包中注入共享主题、变量。

## 常见问题

- **样式顺序异常？** weapp-vite 会按固定顺序注入不同后缀的文件，建议团队统一主力格式（例如全部使用 `.scss`）。
- **SCSS 引入 `.wxss` 报错？** 这是 Sass 的限制。可以将共享样式改为 `.scss`，或在编译后通过 `@wv-keep-import` 保留 WXSS 引入。
- **`@wv-keep-import` 不生效？** 请确认对应文件在构建产物中仍保留了 `@import`，若被其他插件处理，可尝试调整插件顺序或在 PostCSS 阶段配置 `exclude`。
