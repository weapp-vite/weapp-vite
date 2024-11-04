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

> 类型: `string`

`app.json` 的所在位置，创建 `js` 的小程序的时候默认在当前目录，创建 `ts` 小程序项目的时候，会出现在 `miniprogram` 目录中，此时就需要把 `srcRoot` 设置为 `./miniprogram`

<!-- ## watch

- 类型: `object`

通过此选项可以自定义 `watch` 的配置，可传入一个 `chokidar` 配置，[参考配置](https://www.npmjs.com/package/chokidar)

常用为，可通过传入 `paths` 字符串数组来进行文件的额外监听 -->

## jsonAlias

> 类型: `object`

`json` 别名的相关配置

### entries

> 类型：`Record<string, string> | Array<{ find: string | RegExp, replacement: string }>`

对所有的 `json` 配置文件，执行类似 `@rollup/plugin-alias` 的处理方式

详细的使用方式和示例详见 [`Alias 别名`](/guide/alias#json-别名)

当使用文件系统路径的别名时，请始终使用绝对路径。相对路径的别名值会原封不动地被使用，因此无法被正常解析。

## generate

> 类型: `object`

生成脚手架的相关配置

### extensions

> 类型: `object`

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

## npm

> 类型: `object`

构建 `npm` 的相关配置

### tsup

> 类型: `function`

用于配置 `npm` 构建的 `tsup` 配置

```ts
tsup?: (options: TsupOptions) => TsupOptions | undefined
```

## tsconfigPaths

> 类型: `TsconfigPathsOptions`

用于控制传给 `vite-tsconfig-paths` 插件的参数

```ts
tsconfigPaths?: TsconfigPathsOptions
```

相关 `options` 的作用详见 https://www.npmjs.com/package/vite-tsconfig-paths

## subPackages

分包编译的配置

> 类型: `Record<string, { independent?: boolean }>`


传入一个 `object`, `key` 为分包的 `root`, `value` 为对应分包的 `Option`

### independent

> 类型: `boolean`

设置 `independent:true` 来强制启用 独立的 `rollup` 编译上下文
 
默认情况下，当一个分包在 `app.json` 里设置了 `independent: true` 之后会默认启用 `独立编译上下文`

### dependencies

> 类型: `(string | RegExp)[]`
> 默认值: `package.json` 中的 `dependencies` 选项

手动设置某个独立分包的依赖项

比如主包依赖了 `4` 个 `npm` 包，此时会把这 `4` 个包打入主包和各个独立分包的 `miniprogram_npm`

但是在某个独立分包中，可能只依赖了一个 `npm` 包，此时可以手动设置 `dependencies`，让对应的独立分包只构建 `dependencies` 数组内的依赖，从而优化分包的大小

## enhance

> 类型: `object`

增强编译的配置

### wxml

> 类型: `boolean`
> 默认值: `true`

增强 `wxml` 文件的编译，详见 [WXML 增强](/guide/wxml.html)