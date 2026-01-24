# 微信小程序 project.config.json

官方文档: https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html

文件名: `project.config.json`

常见字段:

- `description`: 项目名称。
- `miniprogramRoot`: 小程序源码目录(相对路径)。
- `compileType`: 编译类型, 一般为 `miniprogram`。
- `setting`: 编译/上传相关设置(例如 `es6`、`minified`、`packNpmRelationList`)。
- `libVersion`: 基础库版本。
- `appid`: 小程序 AppID。

示例:

```json
{
  "description": "项目配置文件",
  "miniprogramRoot": "dist",
  "compileType": "miniprogram",
  "setting": {
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    },
    "coverView": false,
    "postcss": false,
    "minified": false,
    "enhance": false,
    "showShadowRootInWxmlPanel": false,
    "packNpmRelationList": [
      {
        "packageJsonPath": "./package.json",
        "miniprogramNpmDistDir": "./dist"
      }
    ],
    "ignoreUploadUnusedFiles": true,
    "compileHotReLoad": false,
    "skylineRenderEnable": true,
    "packNpmManually": true,
    "es6": true
  },
  "simulatorType": "wechat",
  "simulatorPluginLibVersion": {},
  "condition": {},
  "srcMiniprogramRoot": "dist",
  "editorSetting": {
    "tabIndent": "insertSpaces",
    "tabSize": 2
  },
  "libVersion": "2.32.3",
  "packOptions": {
    "ignore": [],
    "include": []
  },
  "appid": "wx6ffee4673b257014"
}
```
