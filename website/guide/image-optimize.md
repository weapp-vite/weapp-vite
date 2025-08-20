# 静态资源的处理与优化

`weapp-vite` 本身, 处理静态资源的策略，和 `vite` 是一致的， 同时支持 `vite` 插件，

## public 目录

你可以在你的目录中，添加 `public` 目录，这个目录通常和 `vite.config.ts` 文件同级，不受到 `weapp.srcRoot` 的影响！

默认情况下, `weapp-vite` 会把 `public` 目录下的文件，按照路径，直接复制到 `dist` 目录下，

> 此配置同样支持自定义，详见 [publicDir](https://cn.vite.dev/config/shared-options#publicdir) 配置项

## 图片压缩

你也可以使用 `vite` 插件，来优化你项目中图片的产物大小，

或者你也把图片放在你的项目中，在编译时全部上传 `OSS`，然后代码里只保留 `CDN` 的引用地址

### vite-plugin-image-optimizer

这个插件使用非常的简单，只需要直接在 `weapp-vite` 中注册，即可优化所有引入图片的大小了

### 使用方式

```bash
pnpm add -D vite-plugin-image-optimizer
```

然后再安装:

```bash
pnpm add -D sharp svgo
```

然后直接在 `vite.config.ts` 中注册，即可生效:

```ts
export default {
  plugins: [
    ViteImageOptimizer({
      /* pass your config */
    }),
  ],
}
```
