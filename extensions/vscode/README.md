# Weapp Vite

面向 `weapp-vite` 项目的 VS Code 官方扩展。

它把 `weapp-vite` 的常用操作和常见页面维护动作直接放进编辑器里，减少在终端、资源管理器、`app.json` 和页面文件之间来回切换。

## 1. 适合谁

- 正在使用 `weapp-vite` 开发微信小程序或多端小程序项目的开发者
- 希望在 VS Code 中直接执行 `dev`、`build`、`open` 等工作流命令的团队
- 想把页面创建、页面声明维护、页面配置同步放进编辑器内完成的项目成员

## 2. 安装与开始使用

### 2.1 安装

在 VS Code 扩展市场中搜索 `weapp-vite` 并安装。

### 2.2 开始使用

1. 用 VS Code 打开你的 `weapp-vite` 项目。
2. 等扩展识别工作区后，状态栏会出现 `weapp-vite` 入口。
3. 打开命令面板，执行 `weapp-vite: Run Action`。
4. 按需选择 `Dev`、`Build`、`Generate`、`Open DevTools` 等动作。

> **提示**：如果没有识别到项目，可以先确认工作区内的 `package.json`、`vite.config.*` / `weapp-vite.config.*`、`app.json` 是否已经建立基本 `weapp-vite` 结构。

## 3. 核心能力

### 3.1 项目命令入口

- 在状态栏直接看到 `weapp-vite` 入口
- 在命令面板里快速执行 `Dev`、`Build`、`Open DevTools`、`Doctor / Info`
- 支持输出面板查看最近命令日志

### 3.2 页面与组件生成

- 内置 `Generate`，可直接创建页面或组件骨架
- 支持在资源管理器中右键目录或文件，直接创建页面或组件
- 生成页面后可直接选择是否同步加入 `app.json`

### 3.3 页面结构维护

- 提供 `weapp-vite Pages` 侧边栏，按顶层页面、分包页面、未声明页面分组查看
- 支持从当前页面快速复制 route、定位到 `app.json`、补齐页面声明
- 支持从 `app.json` 的 route 直接打开页面或创建缺失页面
- 页面文件或目录重命名、移动、删除后，会尽量自动同步 `app.json` 中的 route

### 3.4 页面配置约定

- 新增页面默认使用 `definePageJson(...)`
- 如果历史页面里仍然保留 `<json>` 自定义块，扩展会给出兼容提示，帮助你逐步收敛到 `definePageJson`
- 不把 `<json>` 双写当作默认工作流，避免继续扩大历史兼容写法

### 3.5 编辑器增强

- 为 `.vue` 中的 `<json>` 自定义块提供语法高亮
- 为 `app.json`、`vite.config.*` / `weapp-vite.config.*`、页面 `<json>`、`definePageJson(...)` 提供补全、悬浮和轻量诊断
- 支持本地 `usingComponents` 路径校验、跳转和缺失组件创建
- 内置 `weapp-vite File Icons` 文件图标主题

## 4. 常用命令

你通常只需要记住这几个高频命令：

| 命令                        | 用途                                 |
| --------------------------- | ------------------------------------ |
| `weapp-vite: Run Action`    | 统一入口，按当前上下文推荐可执行动作 |
| `weapp-vite: Dev`           | 启动开发流程                         |
| `weapp-vite: Build`         | 执行构建                             |
| `weapp-vite: Generate`      | 创建页面或组件骨架                   |
| `weapp-vite: Open DevTools` | 打开开发者工具                       |
| `weapp-vite: Show Output`   | 查看扩展输出日志                     |
| `weapp-vite: Open Docs`     | 打开相关文档入口                     |

页面维护相关命令：

| 命令                                          | 用途                                   |
| --------------------------------------------- | -------------------------------------- |
| `weapp-vite: Copy Current Page Route`         | 复制当前页面 route                     |
| `weapp-vite: Reveal Current Page In app.json` | 定位当前页面在 `app.json` 中的声明     |
| `weapp-vite: Add Current Page To app.json`    | 把当前页面加入 `app.json`              |
| `weapp-vite: Open Page From Route`            | 从 `app.json` route 直接跳转到页面文件 |
| `weapp-vite: Create Page From Route`          | 根据 `app.json` route 创建缺失页面     |
| `weapp-vite: Insert definePageJson Template`  | 快速插入页面配置骨架                   |

## 5. 扩展如何识别项目

扩展会综合以下信号判断当前工作区是否是 `weapp-vite` 项目：

- `package.json` 依赖中包含 `weapp-vite`
- `package.json` scripts 中调用了 `wv` 或 `weapp-vite`
- `vite.config.*` 或 `weapp-vite.config.*` 中引用了 `weapp-vite`
- `src/app.json` 或 `app.json` 存在

识别成功后，状态栏会显示 `weapp-vite` 入口。

## 6. 配置项

扩展提供了几组常用配置，适合按团队偏好微调：

| 配置项                                    | 作用                                  |
| ----------------------------------------- | ------------------------------------- |
| `weapp-vite.showStatusBar`                | 控制是否显示状态栏入口                |
| `weapp-vite.enablePackageJsonDiagnostics` | 控制 `package.json` 相关诊断          |
| `weapp-vite.enableAppJsonDiagnostics`     | 控制 `app.json` 相关诊断              |
| `weapp-vite.enableHover`                  | 控制悬浮提示                          |
| `weapp-vite.enableCompletion`             | 控制补全能力                          |
| `weapp-vite.enableWxmlEnhancements`       | 控制 WXML 相关增强能力                |
| `weapp-vite.enableTemplateDecorations`    | 控制模板装饰提示                      |
| `weapp-vite.preferWvAlias`                | 控制命令更偏向 `wv` 还是 `weapp-vite` |
| `weapp-vite.promptFileIcons`              | 控制是否提示切换文件图标主题          |

> **说明**：如果你更偏好显式命令名，可以关闭 `weapp-vite.preferWvAlias`，扩展会优先生成 `weapp-vite dev` 这一类命令形式，而不是 `wv dev`。

## 7. 常见使用场景

### 7.1 新建页面

1. 执行 `weapp-vite: Generate`。
2. 选择创建页面。
3. 选择目标目录。
4. 按提示决定是否同步加入 `app.json`。

### 7.2 修复页面声明缺失

1. 打开页面文件。
2. 执行 `weapp-vite: Add Current Page To app.json`。
3. 或者在 `weapp-vite Pages` 视图中直接对未声明页面执行修复动作。

### 7.3 从 route 跳回源码

1. 在 `app.json` 中把光标放到页面 route 上。
2. 使用 `Cmd/Ctrl + Click`，或执行 `weapp-vite: Open Page From Route`。
3. 扩展会直接跳转到对应页面文件。

### 7.4 收敛历史 `<json>` 页面

1. 如果旧页面同时使用了 `definePageJson(...)` 与 `<json>`，扩展会提示这是历史兼容写法。
2. 建议把页面配置统一迁移到 `definePageJson(...)`，逐步移除重复的 `<json>` 块。

## 8. 问题反馈

- 仓库主页：https://github.com/weapp-vite/weapp-vite
- 插件源码目录：https://github.com/weapp-vite/weapp-vite/tree/main/extensions/vscode
- 问题反馈：https://github.com/weapp-vite/weapp-vite/issues

## 9. 开发与维护说明

如果你是扩展维护者，或需要本地调试、打包和发布，请改看下面两份文档：

- [DEVELOPMENT.md](./DEVELOPMENT.md)
- [PUBLISHING.md](./PUBLISHING.md)
