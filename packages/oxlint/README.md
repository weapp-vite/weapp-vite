# @weapp-vite/oxlint

为原生、Wevu 与 React 小程序提供 Oxlint 脚本规则预设。规则复用 `@weapp-vite/eslint` 的运行时 API 与 Wevu 兼容清单；不会给小程序源码启用浏览器或 Node.js 环境。

```ts
import { miniProgramRecommended } from '@weapp-vite/oxlint'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  lint: miniProgramRecommended,
})
```

Wevu 项目使用 `wevuRecommended`，React 项目使用 `reactRecommended`。Vite Plus 模板使用 Vite+ 1.2.0，其内置 Oxlint 为 1.88.0。预设通过 `@weapp-vite/oxlint/plugin` 注册自己的 JS 插件，无须额外安装另一份 Oxlint。

| 规则 | 级别 | 适用预设 |
| --- | --- | --- |
| `weapp-vite/no-unsupported-runtime-api` | error | 原生、React、Wevu |
| `weapp-vite/no-implicit-runtime-polyfill` | warn | 原生、React、Wevu |
| `weapp-vite/no-unsupported-api` | error | Wevu |
| `weapp-vite/no-risky-api` | warn | Wevu |
| `react/rules-of-hooks` | error | React |
| `react/exhaustive-deps` | warn | React |

运行时规则只检查 `src` 下的 JS、TS、JSX、TSX 和 Vue 脚本；忽略测试、脚本、Web-only 文件、`node.*`、受管支持文件及生成产物。局部变量、显式兼容实现导入、`typeof` 能力探针与类型引用不会被当成隐式宿主 API。

`no-debugger` 与 `eqeqeq` 默认报错，Oxlint correctness 类规则默认警告。React 预设额外启用内置 React 插件，检查 Hooks 调用顺序和依赖数组，仍保留小程序宿主的 API 边界。配置与构建脚本使用独立的 Node.js 环境。

Oxlint 不提供 `vue-eslint-parser` 的模板访问接口。Wevu 的 Vue 模板检查继续使用 ESLint 的 `wevu/no-unsupported-template-feature`；WXSS、CSS、SCSS 和 Vue `<style>` 的语义检查继续使用 Stylelint。格式统一交给 `@weapp-vite/oxfmt`。

```sh
pnpm exec vp lint
pnpm exec vp lint --fix
```

可直接展开预设再添加 `rules` 或 `overrides`；添加 override 时保留预设的 `overrides` 数组，避免取消运行时代码范围约束。
