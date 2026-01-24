# 百度智能小程序 project.swan.json

官方文档: https://smartprogram.baidu.com/docs/develop/devtools/projectconfig/

文件名: `project.swan.json`

常见字段:

- `smartProgramRoot`: 小程序源码目录(相对路径)。
- `appid`: 小程序 AppID。
- `compileType`: 编译类型。
- `setting`: 项目设置(例如 `urlCheck`)。
- `compilation-args`: 编译参数, 包含 `common` / `babelSetting` 等配置。

示例:

```json
{
  "smartProgramRoot": "dist",
  "appid": "your_appid",
  "compileType": "miniprogram",
  "setting": {
    "urlCheck": true
  },
  "compilation-args": {
    "common": {
      "ignoreTransJs": false,
      "ignorePrefixCss": false,
      "ignoreUglify": false,
      "babelSetting": {
        "ignore": []
      }
    }
  }
}
```
