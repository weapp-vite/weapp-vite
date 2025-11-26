# Plugin Demo

这是一个基于 `weapp-vite` 的微信插件开发示例，展示了如何在主小程序中同时维护插件代码并输出 `dist-plugin/**` 结构。

## 快速开始

```sh
pnpm i        # 安装依赖（在仓库根目录执行一次即可）
pnpm --filter plugin-demo dev        # 启动开发模式
pnpm --filter plugin-demo dev --open # 开发同时拉起微信开发者工具
```

- 主包源码位于 `miniprogram/`
- 插件源码位于 `plugin/`
- 修改插件中的 JS/WXML/WXSS 时会自动热更新

## 构建产物

```sh
pnpm --filter plugin-demo build
```

编译完成后，插件产物会出现在：

```
dist-plugin/
├── plugin.json
├── index.js
├── components/hello-component/…
└── pages/hello-page/…
```

可以直接将 `dist` 目录导入微信开发者工具，插件产物也会实时同步到仓库根目录的 `dist-plugin/`。若只需上传插件，则将 `dist-plugin` 打包上传到插件管理后台即可。

更多细节请参考文档：[微信小程序插件开发](../../website/guide/plugin.md)。***
