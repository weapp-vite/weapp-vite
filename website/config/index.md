# 配置项

`weapp-vite` 配置项继承自 `vite` 所以你可以在里面使用几乎所有的 `vite` 配置，以及注册插件:

配置主要通过 `vite.config.ts` 进行更改:

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  // 其他的 vite 配置项
  // weapp 为 weapp-vite 专属的配置项
  weapp: {
    // srcRoot: 'packageA',
  },
})
```

其他的 `vite` 配置项可通过访问 [Vite中文文档/配置项](https://cn.vitejs.dev/config/) 获取

这里只展示 `weapp-vite` 特有的配置项

## srcRoot

- 类型: `string`

`app.json` 的所在位置，创建 `js` 的小程序的时候默认在当前目录，创建 `ts` 小程序项目的时候，会出现在 `miniprogram` 目录中，此时就需要把 `srcRoot` 设置为 `./miniprogram`

<!-- ## watch

- 类型: `object`

通过此选项可以自定义 `watch` 的配置，可传入一个 `chokidar` 配置，[参考配置](https://www.npmjs.com/package/chokidar)

常用为，可通过传入 `paths` 字符串数组来进行文件的额外监听 -->

## jsonAlias.entries

类型：`Record<string, string> | Array<{ find: string | RegExp, replacement: string }>`

对所有的 `json` 配置文件，执行类似 `@rollup/plugin-alias` 的处理方式

详细的使用方式和示例详见 [`Alias 别名`](/guide/alias#json-别名)

当使用文件系统路径的别名时，请始终使用绝对路径。相对路径的别名值会原封不动地被使用，因此无法被正常解析。

## generate.extensions

用于配置生成脚手架的产物后缀

```ts
{
  generate?: {
    extensions?: Partial<{
      js: string
      json: string
      wxml: string
      wxss: string
    }>
  }
}
```

## npm.tsup

用于配置 `npm` 构建的 `tsup` 配置

```ts
tsup?: (options: TsupOptions) => TsupOptions | undefined
```
