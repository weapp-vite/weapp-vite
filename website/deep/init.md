# weapp-vite init 做了什么?

> 如果你需要纯手工进行安装，推荐阅读此章节
>
> 此章节为 `@weapp-core/init` 的实现，具体可以查看 `@weapp-core/init` 的源代码

## 修改 `project.config.json`

在 `project.config.json` 里添加 `miniprogramRoot` 和 `npm` 构建相关的设置

这是为了把微信开发者工具的预览指到 `dist` 目录，同时 `npm` 做一些相应的修改

## 修改 `package.json`

为了构建 `npm` 和添加一些启动脚本

## 添加 `tsconfig.json` 和 `vite-env.d.ts`

这是为了提供 `ts` 的支持和类型感应

## 添加 `vite.config.[m]ts`

这是为了提供 `vite` 和 `weapp-vite` 的支持和配置

## 添加 `.gitignore`

基础配置
