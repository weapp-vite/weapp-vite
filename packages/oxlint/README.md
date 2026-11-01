# @weapp-vite/oxlint

为原生、Wevu 与 React 小程序提供 Oxlint 脚本规则预设及组合语言检查 CLI。规则复用 `@weapp-vite/eslint` 的运行时 API 与 Wevu 兼容清单；不会给小程序源码启用浏览器或 Node.js 环境。

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

Wevu 预设启用 Oxlint 内置 Vue 规则。Oxlint 不提供 `vue-eslint-parser` 的完整模板访问接口，需要 parser services 的 Vue 模板检查继续使用 ESLint 的 `wevu/no-unsupported-template-feature`。WXSS、ACSS、TTSS、QSS、JXSS、TYSS、CSS、SCSS 和 Vue `<style>` 的语义检查继续使用 Stylelint，关闭与 Oxfmt 重复的格式规则。

```sh
pnpm exec weapp-vite-lint
pnpm exec weapp-vite-lint --fix
pnpm exec weapp-vite-lint --native-only
```

组合 CLI 执行标准 `vp lint`，并使用 `@weapp-vite/language-service` 检查 WXML、AXML、TTML、SWAN、JXML、QML、KSML、XHSML、TYML，以及独立/内联 WXS、SJS、KS、filter 和对应编译源文件。`--fix` 只自动修复 Oxlint 负责的内容，原生语言错误需修改源码；`--native-only` 单独运行平台语言诊断。`--deny-warnings` 将语言警告一并计为失败。

平台配置放在 `vite.config.ts` 的 `weapp.language` 中，支持按文件 glob 覆盖；SJS 等共享后缀存在歧义或引用冲突时需明确平台。原生模块按平台的模块系统和内建 API 校验，不能把 AppService 的 JS/TS 规则套在所有脚本模块上。配置、诊断偏移和作用域模型与 VSCode 共用。

普通 `vp lint` / `oxlint` 仍可直接使用这些预设，但不会替代组合 CLI 的原生语言检查。此工具不新增完整模板类型检查器；静态检查、VSCode 与构建通过不代表真实小程序 IDE runtime 已验收。

可直接展开预设再添加 `rules` 或 `overrides`；添加 override 时保留预设的 `overrides` 数组，避免取消运行时代码范围约束。
