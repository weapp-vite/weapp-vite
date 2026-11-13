# formatWxml 改变嵌套文本的空白

建议 Issue 标题：`[Bug]: formatWxml 为嵌套 text 插入换行和缩进，改变文本内容`

## 复现

在仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm run repro:format
```

两个构建消费同一个 SFC，唯一语义配置差异为 `weapp.vue.template.formatWxml`；输出分别保存在本目录的 `dist/formatted` 和 `dist/compact`，互不覆盖。

核心模板：

```vue
<view><text id="actual">总重：<text>{{ weight }}</text>kg</text></view>
<view><text id="reference">总重：123kg</text></view>
```

`weight = ref(123)`。第二行提供没有嵌套标签的显示对照。

## 实际结果

在 Node.js 24.22.2 / pnpm 12.18.0 下，已构建 `weapp-vite@7.10.0` 并读取真实生成的 WXML。`verify.mjs` 去掉测试节点内部的标签后，得到：

```text
formatted: "\n    总重：\n    {{weight}}\n    kg\n  "
compact:   "总重：{{weight}}kg"
```

开启格式化后的 WXML：

```xml
<view>
  <text id="actual">
    总重：
    <text>{{weight}}</text>
    kg
  </text>
</view>
```

这不是对整个产物文本做简单 diff：验证脚本只比较实际 `<text>` 的文本内容，确认额外空白进入文本节点内部，且去除空白后的内容一致。脚本退出码为 0 表示本版本仍存在该问题；修复后该断言应不再成立。

## 原生渲染观察

分别把以下两个目录导入微信开发者工具，并打开 `pages/index/index`：

- `examples/format-wxml/dist/formatted`
- `examples/format-wxml/dist/compact`

构建器会在两个目录分别生成 `project.config.json`，使用 `touristappid`，不需要项目私有 AppID、账号或后端。不要对产物再次启用 WXML 压缩，以免引入额外变量。比较第一行嵌套文本与第二行对照文本，以及两个项目之间的显示。

上述自动验证证明产物文本内容已改变；原生视觉结果需通过这一步观察。

## 预期结果

格式化只能调整不影响语义的输出空白。即使 `<text>` 内存在非自闭合子标签，开启与关闭 `formatWxml` 也不应改变其文本内容。

临时绕过：`formatWxml: false`。开发态默认格式化与生产态默认不格式化时，也会经过这两种不同处理。

## 上游定位

[7.10.0 的 format.ts](https://github.com/weapp-vite/weapp-vite/blob/weapp-vite%407.10.0/packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/format.ts) 中的 `shouldKeepInline()` 不将带有普通嵌套标签的文本保留在单行，后续格式化过程插入换行和缩进。
