# vite-plugin-performance

## 1.0.0

### Major Changes

- [`896e5b9`](https://github.com/weapp-vite/weapp-vite/commit/896e5b95069c8f430467a8b5bd4f9d50a26517e2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重写核心 `wrapPlugin` 实现：支持钩子白名单/全包裹、自定义计时器、日志与格式化，并对异步钩子和异常做统一耗时统计
  - 新增类型与选项解析工具，暴露 `DEFAULT_PLUGIN_HOOKS`、`resolveOptions` 等扩展能力，同时修复 `slient` 旧拼写兼容
  - 通过新增 7 个 Vitest 用例覆盖阈值、静默模式、插件数组、匿名插件等关键路径；README/README.zh-CN 双语重写并互链
    s

## 1.0.0-alpha.0

### Major Changes

- [`896e5b9`](https://github.com/weapp-vite/weapp-vite/commit/896e5b95069c8f430467a8b5bd4f9d50a26517e2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重写核心 `wrapPlugin` 实现：支持钩子白名单/全包裹、自定义计时器、日志与格式化，并对异步钩子和异常做统一耗时统计
  - 新增类型与选项解析工具，暴露 `DEFAULT_PLUGIN_HOOKS`、`resolveOptions` 等扩展能力，同时修复 `slient` 旧拼写兼容
  - 通过新增 7 个 Vitest 用例覆盖阈值、静默模式、插件数组、匿名插件等关键路径；README/README.zh-CN 双语重写并互链
    s

## 0.0.1

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade
