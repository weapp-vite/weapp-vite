# 静态资源优化

`weapp-vite` 本身支持 `vite` 插件，

所以你可以使用 `vite` 插件，来优化你项目中图片的产物大小，

或者你也把图片放在你的项目中，在编译时全部上传 `OSS`，然后代码里只保留 `CDN` 的引用地址

## vite-plugin-image-optimizer

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
