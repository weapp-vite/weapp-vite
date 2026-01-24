# 支付宝小程序 mini.project.json

官方文档: https://opendocs.alipay.com/mini/006kxd

文件名: `mini.project.json`

常见字段:

- `format`: 固定为 `2`。
- `compileType`: `mini`(应用) 或 `plugin`(插件)。
- `miniprogramRoot`: 小程序源码目录(相对路径)。
- `compileOptions`: 编译选项(例如 `typescript`、`less`)。
- `uploadExclude` / `assetsInclude`: 上传/打包的黑白名单。

示例:

```json
{
  "format": 2,
  "compileType": "mini",
  "miniprogramRoot": "dist",
  "compileOptions": {
    "typescript": true
  }
}
```
