# 自动npm构建

<cite>
**本文档中引用的文件**   
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts)
- [config.ts](file://packages/weapp-vite/src/types/config.ts)
- [npm.md](file://website/config/npm.md)
- [build.ts](file://packages/weapp-vite/src/cli/commands/build.ts)
- [packages.ts](file://packages/rolldown-require/src/packages.ts)
</cite>

## 目录
1. [简介](#简介)
2. [核心功能与工作原理](#核心功能与工作原理)
3. [依赖分析与包管理器集成](#依赖分析与包管理器集成)
4. [构建优化策略](#构建优化策略)
5. [配置指南](#配置指南)
6. [缓存机制](#缓存机制)
7. [构建流程](#构建流程)
8. [常见问题与解决方案](#常见问题与解决方案)
9. [总结](#总结)

## 简介

weapp-vite的自动npm构建功能旨在简化微信小程序中npm依赖的管理和构建过程。通过自动化处理npm依赖，开发者可以避免手动构建npm包的繁琐操作，从而提升开发效率。该功能支持多种包管理器（如pnpm、yarn、npm），并提供了灵活的配置选项来满足不同项目的需求。

**Section sources**
- [npm.md](file://website/config/npm.md#L3-L24)

## 核心功能与工作原理

weapp-vite的自动npm构建功能主要通过`NpmService`接口实现，该接口定义了处理npm依赖所需的各种方法。这些方法包括获取依赖缓存文件路径、检查依赖缓存是否过期、构建单个包以及整体构建等。

### NpmService接口

`NpmService`接口是自动npm构建的核心，它提供了一系列方法来处理npm依赖：

- `getDependenciesCacheFilePath`: 获取依赖缓存文件的路径。
- `dependenciesCacheHash`: 计算当前依赖的哈希值。
- `isMiniprogramPackage`: 判断一个包是否为小程序专用包。
- `shouldSkipBuild`: 决定是否跳过构建过程。
- `writeDependenciesCache` 和 `readDependenciesCache`: 写入和读取依赖缓存。
- `checkDependenciesCacheOutdate`: 检查依赖缓存是否已过期。
- `bundleBuild` 和 `copyBuild`: 分别用于打包和复制构建结果。
- `buildPackage`: 构建单个npm包。
- `getPackNpmRelationList`: 获取npm包的关系列表。
- `build`: 执行完整的npm构建流程。

这些方法共同协作，确保了npm依赖能够被正确地解析、构建和输出。

**Section sources**
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L17-L30)

## 依赖分析与包管理器集成

weapp-vite通过`getPackageInfo`和`resolveModule`函数来解析npm包的信息和模块入口。这些函数利用`local-pkg`库来查找和解析包信息，支持多种包管理器（如pnpm、yarn、npm）。

### 包信息解析

`getPackageInfo`函数负责获取指定包的详细信息，包括`package.json`内容和根路径。这使得weapp-vite能够准确地了解每个依赖的具体情况。

### 模块入口解析

`resolveModule`函数用于解析模块的入口文件。如果无法解析某个模块，则会记录警告信息并跳过该模块的处理。

### 支持的包管理器

weapp-vite支持主流的包管理器，包括：
- **npm**: 最常用的JavaScript包管理器。
- **yarn**: 提供更快的安装速度和更好的依赖锁定。
- **pnpm**: 使用硬链接和符号链接减少磁盘空间占用，提高安装速度。

通过统一的接口，weapp-vite能够无缝集成这些包管理器，无需开发者进行额外配置。

**Section sources**
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L10-L11)
- [packages.ts](file://packages/rolldown-require/src/packages.ts#L51-L346)

## 构建优化策略

为了提高构建效率，weapp-vite采用了多种优化策略，包括缓存机制、并行构建和条件跳过构建。

### 缓存机制

weapp-vite使用文件系统缓存来存储已构建的依赖。每次构建前，都会检查缓存中的哈希值与当前依赖的哈希值是否一致。如果不一致或缓存不存在，则重新构建；否则，直接使用缓存的结果。

### 并行构建

在处理多个依赖时，weapp-vite采用并行构建的方式，利用`Promise.all`同时处理多个包的构建任务，显著提高了构建速度。

### 条件跳过构建

通过`shouldSkipBuild`方法，weapp-vite可以根据输出目录的存在性和依赖缓存的状态决定是否跳过构建。这样可以避免不必要的重复构建，节省时间和资源。

**Section sources**
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L54-L56)
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L177-L179)

## 配置指南

weapp-vite提供了丰富的配置选项，允许开发者根据项目需求定制npm构建行为。主要配置项位于`weapp.npm`字段下。

### 配置选项

- `enable`: 是否启用自动构建npm功能，默认为`true`。
- `cache`: 是否开启缓存，默认为`true`。
- `buildOptions`: 自定义Vite库模式下的构建选项，可以根据包名和入口文件进行个性化配置。

### 示例配置

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    npm: {
      enable: true,
      cache: true,
      buildOptions(options, { name }) {
        if (name === 'lodash') {
          return {
            ...options,
            build: {
              ...options.build,
              target: 'es2018',
              rollupOptions: {
                ...options.build?.rollupOptions,
                treeshake: true,
              },
            },
          }
        }

        if (name === 'dayjs') {
          const external = options.build?.rollupOptions?.external ?? []
          return {
            ...options,
            build: {
              ...options.build,
              rollupOptions: {
                ...options.build?.rollupOptions,
                external: [...external, 'dayjs/plugin/advancedFormat'],
              },
            },
          }
        }

        return options
      },
    },
  },
})
```

此配置示例展示了如何针对特定包（如`lodash`和`dayjs`）应用不同的构建选项，例如调整目标版本和声明外部依赖。

**Section sources**
- [config.ts](file://packages/weapp-vite/src/types/config.ts#L358-L373)
- [npm.md](file://website/config/npm.md#L42-L84)

## 缓存机制

weapp-vite的缓存机制基于文件系统的JSON文件，存储在`node_modules/weapp-vite/.cache/`目录下。每个缓存文件包含一个哈希值，用于标识当前依赖的状态。

### 缓存文件路径

`getDependenciesCacheFilePath`方法生成缓存文件的路径，路径格式为`node_modules/weapp-vite/.cache/{key}.json`，其中`key`是依赖的标识符。

### 缓存哈希计算

`dependenciesCacheHash`方法通过`objectHash`函数计算`package.json`中`dependencies`字段的哈希值。这个哈希值用于判断依赖是否发生变化。

### 缓存读写

`writeDependenciesCache`和`readDependenciesCache`方法分别负责写入和读取缓存文件。当依赖发生变化时，新的哈希值会被写入缓存文件；构建时，会读取缓存文件中的哈希值并与当前依赖的哈希值进行比较。

**Section sources**
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L36-L48)
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L58-L67)
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L69-L74)

## 构建流程

weapp-vite的npm构建流程分为以下几个步骤：

1. **初始化**: 创建`NpmService`实例，并初始化必要的服务（如`configService`）。
2. **获取关系列表**: 调用`getPackNpmRelationList`方法获取npm包的关系列表。
3. **检查缓存**: 使用`checkDependenciesCacheOutdate`方法检查主包的依赖缓存是否过期。
4. **构建主包依赖**: 遍历主包的`dependencies`，对每个依赖调用`buildPackage`方法进行构建。
5. **处理子包依赖**: 对于独立分包，复制主包的`miniprogram_npm`目录，并根据需要过滤特定的依赖。
6. **写入缓存**: 构建完成后，调用`writeDependenciesCache`方法将新的哈希值写入缓存文件。

整个流程确保了所有依赖都能被正确地解析、构建和输出，同时最大限度地利用缓存来提高构建效率。

**Section sources**
- [npmPlugin.ts](file://packages/weapp-vite/src/runtime/npmPlugin.ts#L256-L347)

## 常见问题与解决方案

### miniprogram_npm体积过大

**现象**: `miniprogram_npm`目录体积过大，影响小程序包大小。

**建议排查顺序**:
- 使用`dependencies`精确列出主包依赖。
- 在`subPackages.*.dependencies`中裁剪独立分包的依赖，避免不必要的重复。

### npm构建内容未更新

**现象**: 修改了npm依赖后，构建结果没有更新。

**建议排查顺序**:
- 尝试将`cache`设为`false`。
- 删除`node_modules/.cache/weapp-vite`目录，强制重新构建。

### 某npm包构建失败

**现象**: 特定npm包构建失败，导致构建中断。

**建议排查顺序**:
- 在`buildOptions`中为该包设置`external`或`format`，将其标记为外部依赖。
- 或者改为自动内联，避免构建问题。

**Section sources**
- [npm.md](file://website/config/npm.md#L114-L117)

## 总结

weapp-vite的自动npm构建功能通过智能化的依赖分析、高效的缓存机制和灵活的配置选项，极大地简化了微信小程序中npm依赖的管理。开发者可以通过简单的配置实现复杂的构建逻辑，从而专注于业务开发，提高开发效率。未来，weapp-vite将继续优化构建性能，提供更多实用的功能，助力开发者打造高质量的小程序应用。

**Section sources**
- [npm.md](file://website/config/npm.md#L118-L121)