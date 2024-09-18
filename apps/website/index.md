---
layout: doc
---

# icebreaker's monorepo 模板

## 功能特性

- 强大的 `monorepo` 管理 (`pnpm` + `turborepo`)
- 单元测试 (`vitest`)
- 包括 `cli bin` 全部都是 `typescript`
- 代码规范与质量 (`eslint` + `@icebreakers/eslint-config` + `@icebreakers/stylelint-config`)
- `git` 提交规范 (`husky` + `commitlint` + `lint-staged`)
- `pnpm` 部署 `Docker` 模板
- `Github Action` 自动发布 `npm`, `github release` 包 (`changeset`)
- 配置文件同步升级 `npx @icebreakers/monorepo@latest`

## 如何使用？

首先，访问本模板的 [Github 地址](https://github.com/sonofmagic/monorepo-template)，然后按照一下条件:

- 有 `Github` 账号的，可以登录后，点击右上角的 `Use this template` 按钮

- 没有 `Github` 账号的，可以点击 `Code` 按钮，把这个仓库的源码，或 `clone` 或下载到本地

然后在根目录 (`pnpm-workspace.yaml` 所在的位置) 执行 `pnpm i` 去安装依赖

> 没有 `pnpm` 的，可以使用 `npm i -g pnpm` 来进行安装。
>
> 什么! 你不会连 [`nodejs`](https://nodejs.org/en) 还没安装吧？

## 清除默认的包(可选)

执行 `pnpm script:clean` 命令，可以删去大部分的初始 `repo`，只保留一个 `@icebreakers/bar` 项目作为发包打包模板。

执行完成之后再去执行 `pnpm i` 来更新 `pnpm-lock.yaml`, 并提交 `lock` 文件来锁定版本

## 模板包介绍

默认把 `repo` 放在 `packages` 和 `apps` 这 `2` 个目录里面

### packages

- `@icebreakers/bar` - `tsup` 打包的库模板
- `@icebreakers/foo` - `unbuild` 打包的库模板（不推荐, `unbuild` 很久没有更新了）
- `@icebreakers/monorepo` - 本仓库的更新配置服务，可直接使用 `npx @icebreakers/monorepo@latest` 执行远端 `cli` 命令

> `tsup` 是使用 `esbuild` 打包库的，`unbuild` 是使用老版本的 `rollup` 进行打包的

### apps

- `@icebreakers/cli` - 使用 `typescript` 编写的 `cli` 程序模板
- `@icebreakers/website` - 文档网站模板，使用 `vitepress` ,也是 [monorepo.icebreaker.top](https://monorepo.icebreaker.top/) 的源代码

## 更新包的依赖

在根目录中执行 `pnpm up -rLi` 来进行包的交互式更新，下面是解释:

- `-r` : `recursive` 递归选中所有 `repo`
- `-L` : `latest` 更新到最新
- `-i` : `interactive` 交互式

## 配置自动发包

本项目使用 [changesets](https://github.com/changesets/changesets) 进行包的发布和 `changelog` 的生成

在使用的时候，首先你需要做一些配置：

1. 首先你需要安装 `Github App`: [changeset-bot](https://github.com/apps/changeset-bot)

2. 然后，来到你复制这个模板仓库(`repo`), 上方里的 `Settings` Tab 页面，进行 2 个操作:

### 1. 在 Github 进行 PR 和发包

选择 `Code and automation` > `Actions` > `General`

然后在右侧 `Workflow permissions` 下方选择: `Read and write permissions`

然后选中 `Allow GitHub Actions to create and approve pull requests`

然后保存即可。

这样 `changeset` 就有权限对你进行 `PR` 和代码版本更新了！

### 2. 在 npm 发包

选择 `Security` > `Secrets and variables` > `Actions`

然后在右侧的 `Repository secrets` 设置你的 `NPM_TOKEN` 这个可以在你的 `npmjs.com` 账号中生成获取

(假如你需要单元测试代码覆盖率，你需要设置 `CODECOV_TOKEN`)

## eslint + stylelint 校验

引用到的规则参考 `https://eslint.icebreaker.top/`

[Github 地址](https://github.com/sonofmagic/eslint-config)

## 内置脚本

- `pnpm script:clean` 删去大部分的初始`repo`，只保留一个 `@icebreakers/bar` 项目作为发包打包模板
- `pnpm script:init` 初始化一些 `package.json` 里的字段
- `pnpm script:sync` 使用 `cnpm sync` 功能，把本地所有的包，同步到 [`npmmirror`](https://www.npmmirror.com/) 上，需要安装 `cnpm`

## 配置同步方式

在根目录下执行: `npx @icebreakers/monorepo@latest`

这个命令会把所有的文件从最新版本，对你本地进行覆盖，你可以从 `git` 暂存区把你不想要的文件剔除

### 参数

`npx @icebreakers/monorepo@latest --raw`

这个命令会从全部文件中去除 `Github` 相关的文件

`npx @icebreakers/monorepo@latest -i`

这个命令会进行命令行选择模式，你可以在这里对想要复制的文件进行筛选

当然你可以同时使用这 `2` 个命令

`npx @icebreakers/monorepo@latest -i --raw`
