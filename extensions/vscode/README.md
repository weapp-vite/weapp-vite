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
2. 等扩展识别工作区后，左侧 Activity Bar 会出现 `Weapp Vite` 专属入口，状态栏也会出现 `weapp-vite` 入口。
3. 打开左侧 `Weapp Vite` 入口，或在命令面板执行 `weapp-vite: Run Action`。
4. 按需选择 `Dev`、`Build`、`Generate`、`Open DevTools` 等动作。

> **提示**：如果没有识别到项目，可以先确认工作区内的 `package.json`、`vite.config.*` / `weapp-vite.config.*`、`app.json` 是否已经建立基本 `weapp-vite` 结构。

## 3. 核心能力

### 3.1 项目命令入口

- 提供独立 `Weapp Vite` Activity Bar 入口，集中放置项目概览、常用任务和页面维护视图
- 在状态栏直接看到 `weapp-vite` 入口
- 在命令面板里快速执行 `Dev`、`Build`、`Open DevTools`、`Doctor / Info`
- 支持输出面板查看最近命令日志

### 3.2 页面与组件生成

- 内置 `Generate`，可直接创建页面或组件骨架
- 支持在资源管理器中右键目录或文件，直接创建页面或组件
- 生成页面后可直接选择是否同步加入 `app.json`

### 3.3 页面结构维护

- 在 `Weapp Vite` 专属侧栏中提供 `Pages` 视图，按顶层页面、分包页面、未声明页面分组查看
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
- 在 `.vue <template>`、HTML 及 WXML、AXML、TTML、Swan、JXML、QML、KSML、XHSML、TyML 中提供小程序模板语法高亮和智能增强
- 原生模板与 WXS/SJS/KS/filter 模块使用 `@weapp-vite/language-service` 的平台诊断和作用域模型，提供循环变量、事件、模块别名与导出成员的补全、悬浮、跳转、引用和重命名
- 命名模板支持本文件与直接 `import` 的声明导航；动态 `is` 表达式继续使用表达式符号服务
- 为静态 class 提供补全、定义跳转、引用、重命名和主题感知语义着色，并支持 CSS、SCSS、Sass、Less、Stylus 嵌套选择器
- 内置 `weapp-vite File Icons` 文件图标主题，可按需手动启用

### 3.6 与 CLI 共用语言规则和格式化器

独立模板使用 `wxml` / `miniprogram-template` 语言；`.wxs`、`.sjs`、`.ks`、`.filter.js`、`.filter.ts` 及 `.wxs.ts` / `.sjs.ts` / `.ks.ts` 等编译源码使用 `miniprogram-script`。原生样式 `.wxss`、`.acss`、`.ttss`、`.qss`、`.jxss`、`.tyss` 关联为 CSS。构建平台仍为既有六平台，QQ、快手和涂鸦的语言 profile 不增加构建目标。

模板格式化只编辑标签与属性布局，保留文本空白、实体、属性值、引号、属性顺序、重复属性和显式闭合形式。项目安装 `@weapp-vite/oxfmt` 与 Vite+ 后，扩展使用项目的同一格式化入口处理标准文件、原生样式和独立/内联脚本模块；方言、结构或语义检查失败时显示诊断并返回零修改。未安装工具的旧项目只保留纯 TS 模板格式化，不自行携带 native 二进制。

项目配置读取 `vite.config.ts` 中的 `weapp.language`、`lint` 和 `fmt`。共享 `.sjs` 或互相冲突的模块归属需要显式配置，不能默认为微信语义。只有受信任工作区才会加载并执行项目配置或项目格式化器；未信任时只进行不执行项目代码的语言分析。

生成项目已将模板和模块的唯一格式化提供者设为 `weapp-vite.weapp-vite`，标准 JS/TS 使用 Oxc。不要把 WXML 关联为 HTML；`lang="js/ts"` 引用的普通编译源文件只有在模板确认归属后才接管模块语言，原生百度 filter 使用 `.filter.js`。内置组件提示以各平台离线数据的官方来源和覆盖清单为准，不借用其他平台补全缺失项。

语言诊断不提供完整模板类型检查器，Vue parser services 专项规则仍由 ESLint 执行，样式语义仍由 Stylelint 检查。CLI、编辑器与构建检查通过，也不代表真实小程序 IDE runtime 已完成验收。

## 4. 常用命令

你通常只需要记住这几个高频命令：

| 命令                                    | 用途                                 |
| --------------------------------------- | ------------------------------------ |
| `weapp-vite: Run Action`                | 统一入口，按当前上下文推荐可执行动作 |
| `weapp-vite: Dev`                       | 启动开发流程                         |
| `weapp-vite: Build`                     | 执行构建                             |
| `weapp-vite: Generate`                  | 创建页面或组件骨架                   |
| `weapp-vite: Open DevTools`             | 打开开发者工具                       |
| `weapp-vite: Use weapp-vite File Icons` | 手动启用 weapp-vite 文件图标主题     |
| `weapp-vite: Show Output`               | 查看扩展输出日志                     |
| `weapp-vite: Open Docs`                 | 打开相关文档入口                     |

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
| `weapp-vite.enableTemplateEnhancements`   | 控制 Vue、HTML 与多端模板增强能力     |
| `weapp-vite.enableTemplateDefinition`     | 控制模板中的点击跳转                  |
| `weapp-vite.enableTemplateDecorations`    | 控制模板变量装饰与 class 语义着色     |
| `weapp-vite.preferWvAlias`                | 控制命令更偏向 `wv` 还是 `weapp-vite` |

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
3. 或者在左侧 `Weapp Vite` 的 `Pages` 视图中直接对未声明页面执行修复动作。

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
