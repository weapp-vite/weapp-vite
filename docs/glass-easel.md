# glass-easel 兼容与迁移检查

微信小程序的 WebView 渲染后端从基础库 `3.8.12` 起支持 glass-easel。当前开发者工具只能选择 `3.7.1` 等低于该门槛的基础库时，应继续使用默认 WebView 引擎；weapp-vite 不会在模板中默认启用 WebView glass-easel。

`componentFramework: "glass-easel"` 单独存在时保持兼容回退，不会启用 WebView glass-easel。只有在开发者工具与真机基础库均确认不低于 `3.8.12` 后，再由用户在宿主 JSON 中显式成对配置：

```json
{
  "componentFramework": "glass-easel",
  "glassEaselWebview": true
}
```

App、Page 和 Plugin 均支持这组配置。插件必须在 `plugin.json` 中声明，不能依赖宿主页面覆盖。`usingComponents` 与 `componentGenerics.*.default` 引用的组件会继承组件框架。weapp-vite 不提供重复的 `weapp.glassEasel` 配置，`app.json`、页面 JSON 和 `plugin.json` 始终是唯一配置源；删除或关闭 `glassEaselWebview` 即可回退。

## 迁移检查

```bash
wv analyze --glass-easel-check
wv analyze --glass-easel-check --json
```

命令在 GE001、GE003、GE004、GE005 存在时返回非 0 退出码。JSON 报告的 `glassEasel` 节点包含最低基础库、官方迁移文档、错误/警告计数和以下稳定诊断码：

| 诊断码  | 说明                                              | 行为                       |
| ------- | ------------------------------------------------- | -------------------------- |
| `GE001` | 显式开启 `glassEaselWebview` 但未选择 glass-easel | 错误                       |
| `GE002` | 使用旧式 `wx-if` / `wx-for`                       | 自动归一化为冒号写法并警告 |
| `GE003` | `wx:for` 作用域内使用 `<include>`                 | 错误，只诊断               |
| `GE004` | 模板仍使用反斜杠转义属性引号                      | 错误，只诊断               |
| `GE005` | SelectorQuery 使用数字开头的 id 或 class          | 错误，只诊断               |
| `GE006` | 使用 `wx.createSelectorQuery().in(this)`          | 迁移建议                   |

普通 `wv dev` / `wv build` 检测到 glass-easel 后也会输出去重警告。GE003、GE004、GE005 可能涉及模板作用域、字符串语义或业务选择器，工具不会自动改写。

官方参考：[glass-easel 适配指引](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html)
