# weapp-vite 核心代码架构文档

## 项目概述

**weapp-vite** 是一个现代化的微信小程序打包工具，基于 Vite 和 Rolldown 构建，提供高性能的开发体验和构建能力。

**版本**: 5.12.0
**Node.js 要求**: >=20.19.0
**许可证**: MIT

---

## 核心技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Rolldown | 1.0.0-beta.56 | 核心打包引擎（Rust-based） |
| Vite | ^8.0.0-beta.4 | 构建工具和开发服务器 |
| Oxc Parser | ^0.105.0 | 高性能 JavaScript 解析器 |
| Babel | ^7.28.5 | JavaScript/TypeScript 转译 |
| PostCSS | ^8.5.6 | CSS 处理 |

---

## 目录结构

```
packages/weapp-vite/
├── src/                          # 源代码目录
│   ├── cli/                      # CLI 命令实现
│   │   └── commands/             # 各个子命令（build, serve, npm 等）
│   ├── context/                  # 编译器上下文管理
│   ├── plugins/                  # 核心 Vite 插件
│   ├── runtime/                  # 运行时服务实现
│   ├── types/                    # TypeScript 类型定义
│   ├── utils/                    # 工具函数
│   ├── auto-import-components/   # 自动导入组件
│   ├── auto-routes.ts            # 自动路由功能
│   ├── cli.ts                    # CLI 入口
│   ├── config.ts                 # 配置系统
│   ├── createContext.ts          # 上下文创建
│   └── index.ts                  # 主入口导出
├── bin/                          # CLI 可执行文件
│   └── weapp-vite.js
├── test/                         # 测试文件
├── analyze-dashboard/            # 构建分析面板
└── package.json
```

---

## 架构设计

### 1. 整体架构

weapp-vite 采用**服务导向架构（Service-Oriented Architecture）**，通过 `CompilerContext` 将各个服务协调起来：

```
┌─────────────────────────────────────────────────────────────┐
│                     CompilerContext                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ConfigService│  │ ScanService  │  │ BuildService │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ NpmService   │  │ WxmlService  │  │ JsonService  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │WatcherService│  │AutoImportSvc │  │AutoRoutesSvc │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ WebService   │  │ RuntimeState │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2. 入口文件

**主入口** (`src/index.ts`):
```typescript
export * from './config'        // 配置 API
export * from './createContext'  // 编译器上下文创建
export * from './types/external' // 外部类型定义
```

**CLI 入口** (`src/cli.ts`):
使用 `cac` 框架实现的命令行工具，支持以下命令：
- `weapp-vite dev` / `weapp-vite serve` - 启动开发服务器
- `weapp-vite build` - 生产构建
- `weapp-vite analyze` - 分析构建产物
- `weapp-vite npm` - NPM 包构建
- `weapp-vite init` - 初始化项目
- `weapp-vite generate` / `weapp-vite g` - 生成脚手架
- `weapp-vite create` - 创建新项目
- `weapp-vite open` - 打开微信开发者工具

### 3. 配置系统

配置系统扩展了 Vite 的 `UserConfig`，通过 `weapp` 字段配置小程序特定选项：

**核心配置项** (`src/types/config.ts`):

```typescript
interface WeappViteConfig {
  // 应用入口目录
  srcRoot?: string              // 默认 '.'

  // 自动路由
  autoRoutes?: boolean          // 默认 false

  // 插件入口目录
  pluginRoot?: string

  // JSON 别名配置
  jsonAlias?: AliasOptions

  // NPM 构建
  npm?: {
    enable?: boolean
    cache?: boolean
    buildOptions?: (options, pkgMeta) => options
  }

  // 分包独立构建
  subPackages?: Record<string, {
    independent?: boolean
    dependencies?: (string | RegExp)[]
    inlineConfig?: InlineConfig
    autoImportComponents?: AutoImportComponentsOption
    watchSharedStyles?: boolean
    styles?: SubPackageStyleConfigEntry[]
  }>

  // Web 运行时
  web?: WeappWebConfig

  // JS 输出格式
  jsFormat?: 'cjs' | 'esm'

  // WXML/WXS 增强
  wxml?: boolean | EnhanceWxmlOptions
  wxs?: boolean

  // 自动导入组件
  autoImportComponents?: AutoImportComponentsOption

  // 代码拆分策略
  chunks?: {
    sharedStrategy?: 'hoist' | 'duplicate'
    logOptimization?: boolean
    forceDuplicatePatterns?: (string | RegExp)[]
    duplicateWarningBytes?: number
  }
}
```

---

## 核心插件系统

### 插件流程 (`src/plugins/index.ts`)

```typescript
export function vitePluginWeapp(ctx, subPackageMeta?): Plugin[] {
  const groups: Plugin[][] = [
    [createContextPlugin(ctx)],  // 上下文提供者
    preflight(ctx),              // 预检查
    asset(ctx),                  // 资源处理
    autoRoutes(ctx),             // 自动路由
    autoImport(ctx),             // 自动导入
    weappVite(ctx, subPackageMeta), // 核心处理
    wxs(ctx),                    // WXS 处理
    css(ctx)                     // CSS 处理
  ]
  return flatten(groups)
}
```

### 核心插件详解

#### 1. **Core Plugin** (`src/plugins/core.ts`)

核心插件包含 4 个子插件：

| 子插件 | 职责 |
|--------|------|
| `createTakeQueryPlugin` | 处理 `take:` 指令，用于模块优化 |
| `createWxssResolverPlugin` | 解析 `.wxss` 文件为 `.css?wxss` |
| `createCoreLifecyclePlugin` | 核心生命周期管理 |
| `createRequireAnalysisPlugin` | 分析 `require()` 调用并按需打包 |

**核心功能**:
- 入口加载和模块解析
- WXML 文件处理和组件注册
- Chunk 共享策略（主包与分包之间）
- 独立分包构建
- 页面预加载移除优化

#### 2. **CSS Plugin** (`src/plugins/css.ts`)

CSS 处理插件，支持：
- PostCSS 集成
- 预处理器支持
- 分包共享样式
- 样式作用域控制

#### 3. **WXS Plugin** (`src/plugins/wxs.ts`)

处理微信小程序的 WXS（WXML Script）文件。

#### 4. **Auto Import Plugin** (`src/plugins/autoImport.ts`)

自动导入组件功能：
- 扫描指定 glob 模式的组件文件
- 监听文件变化自动注册
- 支持自定义 Resolver

#### 5. **Auto Routes Plugin** (`src/plugins/autoRoutes.ts`)

自动路由生成：
- 虚拟模块 `weapp-vite/auto-routes`
- 扫描 `pages/` 目录生成路由清单
- HMR 支持

#### 6. **Workers Plugin** (`src/plugins/workers.ts`)

Web Worker 支持。

---

## 运行时服务

### 1. **ConfigService** (`src/runtime/configPlugin.ts`)

配置管理服务，负责：
- 加载 `vite.config.ts`
- 解析项目配置
- 合并默认配置

### 2. **BuildService** (`src/runtime/buildPlugin.ts`)

构建编排服务，核心功能：

```typescript
interface BuildService {
  queue: PQueue                          // 构建队列
  build: (options?) => Promise<...>     // 执行构建
  buildIndependentBundle: (root, meta)  // 独立分包构建
  getIndependentOutput: (root)          // 获取独立分包输出
  invalidateIndependentOutput: (root)   // 使独立分包失效
}
```

**特性**:
- 开发模式：使用 RolldownWatcher 实现热更新
- 生产模式：执行完整构建
- 并行构建：支持独立分包并行构建
- Worker 构建：独立的 Web Worker 构建

### 3. **ScanService** (`src/runtime/scanPlugin.ts`)

文件扫描服务，负责：
- 扫描 `app.json` 获取页面配置
- 扫描分包配置
- 扫描组件文件
- 检测独立分包

### 4. **NpmService** (`src/runtime/npmPlugin.ts`)

NPM 包构建服务：
- 将 node_modules 构建为 `miniprogram_npm`
- 支持缓存
- 依赖变化检测

### 5. **WxmlService** (`src/runtime/wxmlPlugin.ts`)

WXML 处理服务：
- WXML 模板解析
- 组件注册收集
- 模板增强处理

### 6. **JsonService** (`src/runtime/jsonPlugin.ts`)

JSON 配置处理服务。

### 7. **WatcherService** (`src/runtime/watcherPlugin.ts`)

文件监听服务：
- 管理 RolldownWatcher 实例
- 支持 sidecar watcher（独立分包、插件）
- 文件变化事件分发

### 8. **AutoImportService** (`src/runtime/autoImportPlugin.ts`)

自动导入服务：
- 组件自动发现
- 组件自动注册
- Resolver 机制

### 9. **AutoRoutesService** (`src/runtime/autoRoutesPlugin.ts`)

自动路由服务：
- 路由文件扫描
- 路由清单生成
- 虚拟模块导出

### 10. **WebService** (`src/runtime/webPlugin.ts`)

Web 运行时服务，用于 H5 平台构建。

---

## Chunk 共享策略

**配置** (`src/runtime/chunkStrategy.ts`):

```typescript
type SharedChunkStrategy = 'hoist' | 'duplicate'
```

| 策略 | 行为 |
|------|------|
| `duplicate` (默认) | 将共享代码复制到各自的分包中 |
| `hoist` | 将共享代码提炼到主包 common.js |

**优化逻辑**:
1. 分析主包和分包的共享模块
2. 根据策略决定如何处理共享代码
3. 支持强制复制模式（忽略主包引用）
4. 冗余体积警告（默认阈值 512KB）

---

## 关键文件索引

| 文件 | 行号 | 功能 |
|------|------|------|
| `src/index.ts` | 1-3 | 主入口导出 |
| `src/cli.ts` | 1-50 | CLI 入口 |
| `src/config.ts` | 1-28 | 配置系统定义 |
| `src/createContext.ts` | 1-27 | 编译器上下文创建 |
| `src/plugins/index.ts` | 53-77 | 插件组装 |
| `src/plugins/core.ts` | 45-67 | 核心插件入口 |
| `src/context/CompilerContext.ts` | 14-29 | 上下文类型定义 |
| `src/types/config.ts` | 329-477 | 配置类型定义 |
| `src/runtime/buildPlugin.ts` | 31-374 | 构建服务实现 |

---

## 导出模块

```
weapp-vite/
├── .                    # 主入口（config, createContext, types）
├── /config              # 配置导出
├── /json                # JSON 工具
├── /volar               # VS Code 类型定义
├── /types               # 类型定义
├── /auto-import-components/resolvers  # 自动导入解析器
├── /auto-routes         # 自动路由模块
└── /client              # 客户端类型
```

---

## 总结

weapp-vite 是一个架构清晰、模块化程度高的小程序构建工具。其核心特点包括：

1. **服务导向架构**: 通过 `CompilerContext` 协调各服务
2. **插件化设计**: 基于 Vite 插件系统，扩展性强
3. **性能优化**: 使用 Rolldown (Rust) 作为打包引擎
4. **开发体验**: 完整的 HMR、自动导入、自动路由
5. **分包优化**: 智能的 chunk 共享策略
6. **多平台支持**: 支持微信小程序及 H5 Web 构建

---
