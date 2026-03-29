<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html -->

# 使用分包

## 配置方法

假设支持分包的小程序目录结构如下：

```
├── app.js
├── app.json
├── app.wxss
├── packageA
│   └── pages
│       ├── cat
│       └── dog
├── packageB
│   └── pages
│       ├── apple
│       └── banana
├── pages
│   ├── index
│   └── logs
└── utils
```

开发者通过在 app.json `subPackages` 字段声明项目分包结构：

> 写成 `subpackages` 也支持。

```json
{
  "pages":[
    "pages/index",
    "pages/logs"
  ],
  "subPackages": [
    {
      "root": "packageA",
      "pages": [
        "pages/cat",
        "pages/dog"
      ],
      "entry": "index.js"
    }, {
      "root": "packageB",
      "name": "pack2",
      "pages": [
        "pages/apple",
        "pages/banana"
      ]
    }
  ]
}
```

`subPackages` 中，每个分包的配置有以下几项：

<table><thead><tr><th>字段</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>root</td> <td>String</td> <td>分包根目录</td></tr> <tr><td>name</td> <td>String</td> <td>分包别名，<a href="./preload.html">分包预下载</a>时可以使用</td></tr> <tr><td>pages</td> <td>StringArray</td> <td>分包页面路径，相对于分包根目录</td></tr> <tr><td>independent</td> <td>Boolean</td> <td>分包是否是<a href="./independent.html">独立分包</a></td></tr> <tr><td>entry</td> <td>String</td> <td>分包入口文件</td></tr></tbody></table>

## 打包原则

- 声明 `subPackages` 后，将按 `subPackages` 配置路径进行打包， `subPackages` 配置路径外的目录将被打包到主包中
- 主包也可以有自己的 pages，即最外层的 pages 字段。
- `subPackages` 的根目录不能是另外一个 `subPackages` 内的子目录
- `tabBar` 页面必须在主包内

## 引用原则

- `packageA` 无法 require `packageB` JS 文件，但可以 require 主包、 `packageA` 内的 JS 文件；使用 [分包异步化](./async.md) 时不受此条限制
- `packageA` 无法 import `packageB` 的 template，但可以 require 主包、 `packageA` 内的 template
- `packageA` 无法使用 `packageB` 的资源，但可以使用主包、 `packageA` 内的资源

## 分包入口文件

每个分包的配置中， `entry` 字段可以指定该分包中的任意一个 JS 文件作为入口文件，该文件会在分包注入时首先被执行。

指定的 JS 文件应该填写相对于分包根目录的路径，例如需要指定 `/path/to/subPackage/src/index.js` 作为分包 `/path/to/subPackage` 的入口文件时，应填写 `src/index.js` 。

调试这个功能需要 1.06.2406242 或以上版本的微信开发者工具，正式环境没有版本需求。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/c5PkiKmv74S9)

## 示例项目

[下载 小程序示例（分包加载版）源码](https://res.wx.qq.com/wxdoc/dist/assets/media/demo-subpackages.b42a3adb.zip)
