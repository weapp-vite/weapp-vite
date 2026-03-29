# Project Structure

## 常见目录

典型 `weapp-vite` 项目通常包含这些内容：

- `vite.config.ts`
- `src/`
- `.weapp-vite/`
- `dist/`
- `project.config.json`
- `AGENTS.md`

## 关键文件职责

### `vite.config.ts`

`weapp-vite` 的主要配置入口。`weapp` 相关能力都从这里进入。

### `src/`

小程序源码根目录，通常通过 `weapp.srcRoot` 指定。

### `.weapp-vite/`

托管的 TypeScript 支持文件目录。它通常由 `weapp-vite prepare` 生成或更新。

不要手写依赖它的生成内容并长期偏离工具输出。

### `dist/`

构建产物目录。微信小程序通常会输出到 `dist/build/mp-weixin` 或相近结构。

### `AGENTS.md`

脚手架生成项目中的 AI 工作流说明。AI 代理进入项目后应优先读取。

## AI 处理项目时的顺序

1. 读根目录 `AGENTS.md`
2. 读 `node_modules/weapp-vite/dist/docs/index.md`
3. 读 `vite.config.ts`
4. 再进入 `src/` 与业务代码

## 何时运行 `prepare`

出现这些情况时优先执行 `weapp-vite prepare`：

- `.weapp-vite` 支持文件缺失
- 升级了 `weapp-vite`
- TypeScript / Volar 提示异常
- 工具提示要求重新生成支持文件
