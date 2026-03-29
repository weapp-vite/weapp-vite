<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/preload.html -->

# 分包预下载

> 基础库 2.3.0 开始支持，低版本需做 [兼容处理](../compatibility.md) 。 开发者工具请使用 1.02.1808300 及以上版本，可 [点此下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 。

开发者可以通过配置，在进入小程序某个页面时，由框架自动预下载可能需要的分包，提升进入后续分包页面时的启动速度。对于 [独立分包](./independent.md) ，也可以预下载主包。

**分包预下载目前只支持通过配置方式使用，暂不支持通过调用API完成。**

> vConsole 里有 `preloadSubpackages` 开头的日志信息，可以用来验证预下载的情况。

## 配置方法

预下载分包行为在进入某个页面时触发，通过在 `app.json` 增加 `preloadRule` 配置来控制。

```json
{
  "pages": ["pages/index"],
  "subpackages": [
    {
      "root": "important",
      "pages": ["index"],
    },
    {
      "root": "sub1",
      "pages": ["index"],
    },
    {
      "name": "hello",
      "root": "path/to",
      "pages": ["index"]
    },
    {
      "root": "sub3",
      "pages": ["index"]
    },
    {
      "root": "indep",
      "pages": ["index"],
      "independent": true
    }
  ],
  "preloadRule": {
    "pages/index": {
      "network": "all",
      "packages": ["important"]
    },
    "sub1/index": {
      "packages": ["hello", "sub3"]
    },
    "sub3/index": {
      "packages": ["path/to"]
    },
    "indep/index": {
      "packages": ["__APP__"]
    }
  }
}
```

`preloadRule` 中， `key` 是页面路径， `value` 是进入此页面的预下载配置，每个配置有以下几项：

<table><thead><tr><th>字段</th> <th>类型</th> <th>必填</th> <th>默认值</th> <th>说明</th></tr></thead> <tbody><tr><td>packages</td> <td>StringArray</td> <td>是</td> <td>无</td> <td>进入页面后预下载分包的 <code>root</code> 或 <code>name</code>。<code>__APP__</code> 表示主包。</td></tr> <tr><td>network</td> <td>String</td> <td>否</td> <td>wifi</td> <td>在指定网络下预下载，可选值为：<br> <code>all</code>: 不限网络 <br> <code>wifi</code>: 仅wifi下预下载</td></tr></tbody></table>

## 限制

同一个分包中的页面享有共同的预下载大小限额 2M，限额会在工具中打包时校验。

如，页面 A 和 B 都在同一个分包中，A 中预下载总大小 0.5M 的分包，B中最多只能预下载总大小 1.5M 的分包。
