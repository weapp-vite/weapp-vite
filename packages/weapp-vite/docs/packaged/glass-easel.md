# glass-easel 兼容检查

WebView glass-easel 需要微信基础库 `3.8.12` 或更高，weapp-vite 模板默认不启用。开发者工具只提供低于该门槛的基础库时应保持回退；`componentFramework: "glass-easel"` 单独存在不会开启 WebView glass-easel。

确认开发者工具与真机基础库均满足要求后，由用户在 App、Page 或 Plugin JSON 中显式成对配置：

```json
{
  "componentFramework": "glass-easel",
  "glassEaselWebview": true
}
```

宿主 JSON 是唯一配置源，不要在 `vite.config.ts` 中创建重复配置。插件必须在 `plugin.json` 中声明；组件框架会沿 `usingComponents` 与 `componentGenerics.*.default` 传播。删除或关闭 `glassEaselWebview` 即可回退。

```bash
wv analyze --glass-easel-check
wv analyze --glass-easel-check --json
```

`glassEasel` 报告使用 `GE001` 到 `GE006` 稳定诊断码。工具会安全归一化 `wx-if` / `wx-for`；循环内 `<include>`、旧式反斜杠引号转义和数字开头选择器只诊断，不自动改写。

官方参考：https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html
