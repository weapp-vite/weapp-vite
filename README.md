<p align="center">
<img src="./website/public/logo.png" height="150">
</p>

<h1 align="center">
weapp-vite
</h1>

<p align="center">
<a href="https://deepwiki.com/weapp-vite/weapp-vite"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
给小程序现代化的开发体验
<p>
<p align="center">
<a href="https://vite.icebreaker.top">中文文档</a>
</p>

## 多平台开发（multiPlatform）

开启后必须通过 `--platform` 指定小程序平台，并按平台拆分 `project.config`：

```ts
// vite.config.ts
export default {
  weapp: {
    multiPlatform: true,
  },
}
```

```
config/
  weapp/project.config.json
  weapp/project.private.config.json
  alipay/mini.project.json
  alipay/project.private.config.json
  swan/project.swan.json
  swan/project.private.config.json
  tt/project.config.json
  jd/project.config.json
  xhs/project.config.json
```

```bash
weapp-vite dev -p weapp
weapp-vite dev -p alipay
```

## Projects

- [@weapp-core/init](@weapp-core/init) - @weapp-core/init
- [@weapp-core/logger](@weapp-core/logger) - @weapp-core/logger
- [@weapp-core/schematics](@weapp-core/schematics) - @weapp-core/schematics
- [@weapp-core/shared](@weapp-core/shared) - @weapp-core/shared
- [create-weapp-vite](packages/create-weapp-vite) - create-weapp-vite
- [@weapp-vite/mcp](packages/mcp) - mcp
- [rolldown-require](packages/rolldown-require) - bundle and require a file using rolldown!
- [vite-plugin-performance](packages/vite-plugin-performance) - vite-plugin-performance
- [@weapp-vite/volar](packages/volar) - tsup(esbuild) build package template
- [weapp-ide-cli](packages/weapp-ide-cli) - 让微信开发者工具，用起来更加方便！
- [weapp-vite](packages/weapp-vite) - weapp-vite 一个现代化的小程序打包工具

## Contributing

Contributions Welcome! You can contribute in the following ways.

- Create an Issue - Propose a new feature. Report a bug.
- Pull Request - Fix a bug and typo. Refactor the code.
- Create third-party middleware - Instruct below.
- Share - Share your thoughts on the Blog, X, and others.
- Make your application - Please try to use weapp-vite.

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributors

Thanks to [all contributors](https://github.com/weapp-vite/weapp-vite/graphs/contributors)!

## Authors

ice breaker <1324318532@qq.com>

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
