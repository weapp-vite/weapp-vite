# 我对 monorepo 的一些思考

## 前言

最近在自己的新项目中，我创建并使用了 [monorepo-template](https://github.com/sonofmagic/monorepo-template) 模板，并不断地做了不少改进。

在此，我想借此机会分享一下这个模板的演变过程，以及我对 `monorepo` 的一些思考。

## 它的由来

为了应对越来越多的发包场景，我创建了 [npm-lib-template](https://github.com/sonofmagic/npm-lib-template) 模板

这是一个 `git` 单仓单 `npm` 包模板，使用 `rollup` 进行打包，然后再发布到 `npm` 和 `github`

然而，在后续开发中，我发现单仓库的模式在某些场景下难以应对。

例如，当需要引用其他自己的包，进行单元测试并再次发包时，这时候往往要在多个项目之间进行来回的切换更改，管理复杂度会迅速上升。

`git submodule` 也是另外一条路子，但是我对每次都要同步 `hash` 感到深恶痛绝，遂放弃 (不过某些极其特殊场景的实现，还是只能利用这个功能)。

因此，我决定要创建一个 [monorepo 项目模板](https://github.com/sonofmagic/monorepo-template) ，以应对这些需求。

## 技术选型

### 管理工具

在 `monorepo` 的管理上，我选择了 `pnpm` 和 `turborepo` 这对组合，原因很简单：它们都非常快。

- `pnpm` 又可以节省磁盘空间，又能够链接自特定的内容寻址存储库，是为快也
- `turborepo` 有构建缓存，是为快也 `too`.

### 语言与打包

我选择使用纯 `TypeScript` 来编写所有类库项目，并使用 `tsup` / `unbuild` 进行打包，默认输出格式为 `cjs` 和 `esm`，并利用 `package.json` 中的 `exports` 字段进行分发。

### 直接调试

在直接调试时，我抛弃了 `dist` + `sourcemap` 的调试方式，使用了 `tsx`，它非常适合调试 `TypeScript` 编写的 `CLI` 项目。

### 测试框架

测试方面，我选择了 `vitest`。

它不仅速度快，还很好地支持 `cjs`、`esm` 和 `TypeScript`，同时也适合 `monorepo` 项目。你可以利用 `turbo` 来执行单个的 `vitest` 任务，也可以利用 `vitest.workspace` 来进行多任务测试。

最初我使用的是 `jest` + `ts-jest`，但它对多格式的混合模块的支持不够理想，最终我选择了 `vitest`。

### 代码规范与质量控制

为了保持代码质量，我使用了 `eslint` 和 `stylelint`，并基于自己的配置包 `@icebreakers/eslint-config` 和 `@icebreakers/stylelint-config` 来进行代码格式化和规范化。

我还为 `.vscode` 配置了一些推荐插件和编辑器选项。

此外，通过 `husky` 添加了 `git hook`，配合 `lint-staged` 对提交的代码进行校验。与 `commitlint` 结合使用，以确保 `git` 提交信息符合规范。

### 本地引用与发包替换

利用 `publishConfig` 会在发包的时候替换 `package.json` 字段的方式，在本地包相互引用的时候，都使用 `Typescript` 源文件的方式导出，在 `publishConfig` 里定义的导出为，真正在不同环境中，指向 `dist` 中不同格式的产物地址。

通过这种方式，可以大大加速整个 `monorepo` 的开发测试速度，避免反复通过 `watch` 来构建 `dist` 和 `sourcemap`，也避免一构建出产物，对应的 `Typescript` 文件，就报错的问题。

### 发包流程

我采用了 `changesets`，它在 `monorepo` 环境下发布非常方便。功能非常的多，具体可以查看官方文档。

### Github 相关配置

在 `.github` 目录下，我提供了默认的 `CI/CD` 流程配置，以及用户提交 `issue` 时的模板。经过少量配置后，就可以实现自动发布 `npm` 包、创建 `git tag` 以及生成 `GitHub release`。

此外，模板里还有许多为 `GitHub` 显示优化的 `md` 文档。

## 部署

文档网站通过 `netlify.toml` 配置部署在 `Netlify` 上。最初我使用的是 `Vercel`，但由于**国内**访问速度的原因，最终迁移到了 `Netlify`。

## 总结

从单仓到 `monorepo` 的转变不仅仅是对工具的选择，更是对项目管理模式的优化。通过采用合适的工具链，能够更高效地管理多包项目的同时，利用 `CI/CD` 确保代码的质量和发布的顺畅。

希望这些思考对你有所帮助，也欢迎大家提出各种建议和意见。
