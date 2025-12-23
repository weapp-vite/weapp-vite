# Worker配置

<cite>
**本文档引用文件**  
- [workers.ts](file://packages/weapp-vite/src/plugins/workers.ts)
- [buildPlugin.ts](file://packages/weapp-vite/src/runtime/buildPlugin.ts)
- [merge.ts](file://packages/weapp-vite/src/runtime/config/internal/merge.ts)
- [worker.md](file://website/config/worker.md)
- [vite.config.ts](file://apps/vite-native/vite.config.ts)
- [vite.config.ts](file://apps/vite-native-ts/vite.config.ts)
</cite>

## 目录
1. [Worker配置概述](#worker配置概述)
2. [weapp.worker配置选项](#weappworker配置选项)
3. [Worker构建行为配置](#worker构建行为配置)
4. [实际配置示例](#实际配置示例)
5. [配置对构建过程的影响](#配置对构建过程的影响)
6. [多线程编程最佳实践](#多线程编程最佳实践)

## Worker配置概述

在weapp-vite中，Worker配置允许开发者在小程序中使用多线程编程。当小程序通过`app.json`声明Worker（`workers`字段）时，需要确保构建器同步处理对应脚本。weapp-vite提供了`weapp.worker`选项，用于配置Worker入口、产物路径以及构建策略。

Worker配置的主要目的是将长耗时计算、图像处理、压缩等任务从主线程中分离出来，提高小程序的响应性能。通过weapp-vite的Worker支持，开发者可以将Worker源码交给Vite/Rolldown编译，复用同样的构建、别名、模块分析逻辑。

**Section sources**
- [worker.md](file://website/config/worker.md#L1-L48)

## weapp.worker配置选项

`weapp.worker`配置对象提供了多个属性来控制Worker的构建行为。

### entry（入口配置）

`entry`属性用于指定Worker脚本的入口文件路径。它可以是单个字符串或字符串数组。

- **类型**：`string | string[]`
- **默认值**：`undefined`
- **说明**：当`workersDir`存在且`weapp.worker.entry`未配置时，会抛出错误提示开发者设置入口路径。

在代码实现中，`entry`配置通过`resolveWorkerEntry`函数解析，该函数会检查入口文件是否存在，并返回对应的绝对路径。

```typescript
async function resolveWorkerEntry(
  ctx: CompilerContext,
  entry: string,
): Promise<{ key: string, value?: string }> {
  const { configService, scanService } = ctx
  const relativeEntryPath = path.join(scanService.workersDir!, entry)
  const key = removeExtension(relativeEntryPath)
  const absoluteEntry = path.resolve(configService.absoluteSrcRoot, relativeEntryPath)

  if (isJsOrTs(entry)) {
    const exists = await fs.exists(absoluteEntry)
    if (!exists) {
      logger.warn(`引用 worker: \`${configService.relativeCwd(relativeEntryPath)}\` 不存在!`)
      return { key }
    }

    return { key, value: absoluteEntry }
  }

  const { path: discovered } = await findJsEntry(absoluteEntry)
  if (!discovered) {
    logger.warn(`引用 worker: \`${configService.relativeCwd(relativeEntryPath)}\` 不存在!`)
    return { key }
  }

  return { key, value: discovered }
}
```

**Section sources**
- [workers.ts](file://packages/weapp-vite/src/plugins/workers.ts#L11-L37)
- [worker.md](file://website/config/worker.md#L8-L14)

## Worker构建行为配置

weapp-vite通过插件系统和构建服务来处理Worker的构建行为。

### 构建插件配置

weapp-vite使用`createWorkerBuildPlugin`函数创建Worker构建插件，该插件在构建过程中处理Worker相关的配置。

```typescript
function createWorkerBuildPlugin(ctx: CompilerContext): Plugin {
  const { configService, scanService } = ctx

  return {
    name: 'weapp-vite:workers',
    enforce: 'pre',

    async options(options) {
      const workerConfig = configService.weappViteConfig?.worker
      const entries = Array.isArray(workerConfig?.entry)
        ? workerConfig.entry
        : [workerConfig?.entry]

      const normalized = (await Promise.all(entries.filter(Boolean).map(entry => resolveWorkerEntry(ctx, entry!))))
        .filter((result): result is { key: string, value: string } => Boolean(result.value))
        .reduce<Record<string, string>>((acc, cur) => {
          acc[cur.key] = cur.value
          return acc
        }, {})

      options.input = normalized
    },

    watchChange(id: string, change: { event: ChangeEvent }) {
      logger.success(`[workers:${change.event}] ${configService.relativeCwd(id)}`)
    },

    outputOptions(options) {
      options.chunkFileNames = (chunkInfo) => {
        const workersDir = scanService.workersDir ?? ''
        if (chunkInfo.isDynamicEntry) {
          return path.join(workersDir, '[name].js')
        }

        const sourceId = chunkInfo.facadeModuleId ?? chunkInfo.moduleIds[0]
        const hashBase = typeof sourceId === 'string'
          ? configService.relativeCwd(sourceId)
          : chunkInfo.name

        const stableHash = createHash('sha256')
          .update(hashBase)
          .digest('base64url')
          .slice(0, 8)

        return path.join(workersDir, `${chunkInfo.name}-${stableHash}.js`)
      }
    },
  }
}
```

该插件的主要功能包括：
1. 在`options`钩子中解析Worker入口配置
2. 在`watchChange`钩子中监听Worker文件变化
3. 在`outputOptions`钩子中配置输出文件名格式

**Section sources**
- [workers.ts](file://packages/weapp-vite/src/plugins/workers.ts#L39-L87)

### 构建服务配置

weapp-vite的构建服务通过`buildPlugin.ts`文件中的`checkWorkersOptions`函数检查Worker配置的有效性。

```typescript
function checkWorkersOptions(target: BuildTarget = 'app') {
  if (target === 'plugin') {
    return {
      hasWorkersDir: false,
      workersDir: undefined as string | undefined,
    }
  }
  const workersDir = scanService.workersDir
  const hasWorkersDir = Boolean(workersDir)
  if (hasWorkersDir && configService.weappViteConfig?.worker?.entry === undefined) {
    logger.error('检测到已经开启了 `worker`，请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
    logger.error('比如引入的 `worker` 路径为 `workers/index`, 此时 `weapp.worker.entry` 设置为 `[index]` ')
    throw new Error('请在 `vite.config.ts` 中设置 `weapp.worker.entry` 路径')
  }

  return {
    hasWorkersDir,
    workersDir,
  }
}
```

该函数确保当`workersDir`存在时，必须配置`weapp.worker.entry`，否则会抛出错误提示。

**Section sources**
- [buildPlugin.ts](file://packages/weapp-vite/src/runtime/buildPlugin.ts#L110-L129)

## 实际配置示例

以下是在`vite.config.ts`中配置Worker的完整示例：

```typescript
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    worker: {
      entry: ['src/workers/image.ts', 'src/workers/audio.ts'],
    },
  },
})
```

在实际项目中，如`apps/vite-native/vite.config.ts`中的配置示例：

```typescript
weapp: {
  worker: {
    entry: [
      'index',
    ],
  },
}
```

或者在`apps/vite-native-ts/vite.config.ts`中的配置：

```typescript
weapp: {
  worker: {
    entry: ['index'],
  },
}
```

这些配置告诉weapp-vite需要构建哪些Worker脚本，并将它们包含在最终的构建输出中。

**Section sources**
- [worker.md](file://website/config/worker.md#L19-L32)
- [vite.config.ts](file://apps/vite-native/vite.config.ts#L125-L129)
- [vite.config.ts](file://apps/vite-native-ts/vite.config.ts#L23-L25)

## 配置对构建过程的影响

weapp-vite的Worker配置对构建过程有重要影响，主要体现在以下几个方面：

### 开发模式下的Worker构建

在开发模式下，weapp-vite通过`devWorkers`函数处理Worker的构建：

```typescript
async function devWorkers(workersRoot: string) {
  const workersWatcher = (
    await build(
      configService.mergeWorkers(),
    )
  ) as unknown as RolldownWatcher
  watcherService.setRollupWatcher(workersWatcher, workersRoot)
}
```

`mergeWorkers`函数在`merge.ts`中定义，它合并了Worker相关的构建配置：

```typescript
function mergeWorkers(...configs: Partial<InlineConfig>[]) {
  ensureConfigService()
  const currentOptions = getOptions()
  applyRuntimePlatform('miniprogram')

  if (currentOptions.isDev) {
    const inline = defu<InlineConfig, InlineConfig[]>(
      currentOptions.config,
      ...configs,
      {
        root: currentOptions.cwd,
        mode: 'development',
        plugins: [vitePluginWeappWorkers(ctx as any)],
        define: getDefineImportMetaEnv(),
        build: {
          watch: {},
          minify: false,
          emptyOutDir: false,
        },
      },
    )
    injectBuiltinAliases(inline)
    return inline
  }

  const inlineConfig = defu<InlineConfig, InlineConfig[]>(
    currentOptions.config,
    ...configs,
    {
      root: currentOptions.cwd,
      mode: 'production',
      plugins: [vitePluginWeappWorkers(ctx as any)],
      define: getDefineImportMetaEnv(),
      build: {
        emptyOutDir: false,
      },
    },
  )
  inlineConfig.logLevel = 'info'
  injectBuiltinAliases(inlineConfig)
  return inlineConfig
}
```

### 生产模式下的Worker构建

在生产模式下，weapp-vite通过`buildWorkers`函数构建Worker：

```typescript
async function buildWorkers() {
  await build(
    configService.mergeWorkers(),
  )
}
```

构建过程会：
1. 解析`entry`列表，生成Worker构建上下文
2. 将编译后的产物输出到与主包一致的`dist/`目录
3. 支持TypeScript/ESM/依赖别名等语法，与主包保持一致的开发体验

**Section sources**
- [buildPlugin.ts](file://packages/weapp-vite/src/runtime/buildPlugin.ts#L131-L144)
- [merge.ts](file://packages/weapp-vite/src/runtime/config/internal/merge.ts#L46-L87)

## 多线程编程最佳实践

在使用weapp-vite的Worker配置时，遵循以下最佳实践可以获得更好的开发体验和性能表现：

### 1. 合理规划Worker任务

将长耗时计算、图像处理、压缩等任务放在Worker中执行，避免阻塞主线程。例如：

```typescript
// image.worker.ts
worker.onMessage((res) => {
  // 处理图像数据
  const processedImage = processImage(res.data)
  worker.postMessage(processedImage)
})
```

### 2. 正确配置入口路径

确保`weapp.worker.entry`配置正确，指向实际存在的Worker脚本文件。避免配置不存在的路径，否则会收到警告：

```
引用 worker: `src/workers/nonexistent.ts` 不存在!
```

### 3. 利用npm依赖

Worker可以使用npm依赖，weapp-vite会复用Vite库模式处理npm包。如果Worker依赖特定库，请确保在`dependencies`中已声明。

### 4. 调试Worker构建

可以通过`weapp.debug`选项调试Worker构建过程，输出`watchFiles`、`resolveId`日志，确认Worker脚本是否命中构建。

### 5. 处理文件变化

weapp-vite会监听Worker目录下的文件变化，并在文件添加、修改或删除时重新构建：

```typescript
workerWatcher.on('all', (event, id) => {
  if (!id) {
    return
  }
  if (event === 'add') {
    logWorkerEvent(event, id, 'success')
    void devWorkers(workersDir)
    return
  }
  logWorkerEvent(event, id)
})
```

### 6. 保持目录结构一致

当Worker与分包同时存在时，保持目录结构一致，便于管理和维护。

**Section sources**
- [worker.md](file://website/config/worker.md#L39-L47)
- [buildPlugin.ts](file://packages/weapp-vite/src/runtime/buildPlugin.ts#L168-L227)