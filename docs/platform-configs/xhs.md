# 小红书小程序 project.config.json

官方文档: https://miniapp.xiaohongshu.com/doc/DC977105

文件名: `project.config.json`

常见字段:

- `description`: 项目名称。
- `miniprogramRoot`: 小程序源码目录(相对路径)。
- `compileType`: 编译类型。
- `setting`: 编译/上传相关设置(例如 `es6`、`compileHotReload`、`packNpmRelationList`)。
- `appid`: 小程序 AppID。

示例:

```json
{
  "description": "项目配置文件",
  "miniprogramRoot": "dist",
  "compileType": "miniprogram",
  "setting": {
    "useCompilerPlugins": [],
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
    "compileHotReload": false,
    "skylineRenderEnable": true,
    "es6": true,
    "swc": false
  },
  "appid": "your_appid"
}
```
