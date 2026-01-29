# @weapp-core/init

## 简介

`@weapp-core/init` 用于初始化 weapp-vite 项目的基础配置文件，包含 `project.config`、`package.json`、`.gitignore`，并在需要时生成 `vite.config` 与 TypeScript 相关文件。

## 特性

- 初始化/更新小程序项目配置
- 自动写入 `package.json` 与 `.gitignore`
- 可根据命令类型生成 `vite.config` 与 `tsconfig` 系列文件

## 安装

```bash
pnpm add @weapp-core/init
```

## 使用

```ts
import { initConfig } from '@weapp-core/init'

await initConfig({
  root: process.cwd(),
  command: 'weapp-vite',
})
```

## 配置

`initConfig(options)` 选项：

- `root`：项目根目录（默认 `process.cwd()`）
- `command`：当为 `weapp-vite` 时会额外生成 `vite.config` 与 TS 配置文件

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
