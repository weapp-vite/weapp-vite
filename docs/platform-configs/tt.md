# 抖音小程序 project.config.json

官方文档: https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/framework/general-configuration/

文件名: `project.config.json`

常见字段:

- `appid`: 小程序 AppID。
- `projectname`: 项目名称。
- `miniprogramRoot`: 小程序源码目录(相对路径)。
- `setting`: 编译/开发设置(例如 `es6`、`urlCheck`、`compileHotReLoad`)。
- `packOptions`: 打包时的 `include` / `ignore` 规则。

示例:

```json
{
  "appid": "your_appid",
  "projectname": "multi-platform-demo",
  "miniprogramRoot": "dist",
  "setting": {
    "es6": true,
    "urlCheck": false,
    "compileHotReLoad": false
  },
  "packOptions": {
    "ignore": [],
    "include": []
  }
}
```
