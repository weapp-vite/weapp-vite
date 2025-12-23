# 工具API

<cite>
**本文档中引用的文件**  
- [file.ts](file://packages/weapp-vite/src/utils/file.ts)
- [json.ts](file://packages/weapp-vite/src/utils/json.ts)
- [regexp.ts](file://packages/weapp-vite/src/utils/regexp.ts)
- [version.ts](file://packages/weapp-vite/src/utils/version.ts)
- [weappConfig.ts](file://packages/weapp-vite/src/utils/weappConfig.ts)
- [index.ts](file://packages/weapp-vite/src/utils/index.ts)
</cite>

## 目录
1. [介绍](#介绍)
2. [整体架构与设计理念](#整体架构与设计理念)
3. [核心工具函数详解](#核心工具函数详解)
   1. [文件操作工具](#文件操作工具)
   2. [JSON处理工具](#json处理工具)
   3. [正则表达式工具](#正则表达式工具)
   4. [版本处理工具](#版本处理工具)
   5. [小程序配置工具](#小程序配置工具)
4. [设计原则与性能考虑](#设计原则与性能考虑)
5. [实际应用场景示例](#实际应用场景示例)
6. [错误处理机制与边界情况](#错误处理机制与边界情况)

## 介绍

weapp-vite 是一个专为小程序开发设计的构建工具，其核心功能依赖于一系列精心设计的工具函数。这些工具函数分布在 `@weapp-vite` 包的 `src/utils` 目录下，为整个构建流程提供了基础支持。本文档旨在详细说明这些工具函数的API，包括它们的函数签名、参数说明、返回值描述和使用示例，帮助开发者更好地理解和使用该工具。

## 整体架构与设计理念

weapp-vite 工具库的架构遵循模块化和高内聚低耦合的设计原则。其工具函数被组织在 `packages/weapp-vite/src/utils` 目录中，每个文件负责一个特定的功能领域，如文件操作、JSON处理、正则表达式等。这种设计使得代码结构清晰，易于维护和扩展。

设计理念上，该工具库强调**实用性**和**健壮性**。所有工具函数都经过充分的单元测试（位于 `test` 目录），确保在各种边界条件下都能稳定运行。同时，函数设计简洁，API直观，降低了开发者的学习和使用成本。通过 `index.ts` 文件统一导出所有工具函数，为外部提供了单一的导入入口，简化了使用方式。

## 核心工具函数详解

### 文件操作工具

文件操作工具主要封装了对文件系统的基本操作，简化了路径处理和文件查找的复杂性。

**Section sources**
- [file.ts](file://packages/weapp-vite/src/utils/file.ts#L1-L147)

#### `changeFileExtension(filePath: string, extension: string): string`
- **功能**: 更改文件路径的扩展名。
- **参数**:
  - `filePath`: 要修改的文件路径。
  - `extension`: 新的扩展名，可以带点（`.`）也可以不带。
- **返回值**: 修改扩展名后的新文件路径。
- **使用示例**:
  ```typescript
  changeFileExtension('src/main.js', '.ts'); // 返回 'src/main.ts'
  ```

#### `findJsEntry(filepath: string): Promise<{ predictions: string[], path?: string }>`
- **功能**: 根据给定的文件路径，查找可能存在的JavaScript/TypeScript入口文件。
- **参数**: `filepath`: 基础文件路径。
- **返回值**: 一个包含 `predictions`（所有可能的文件路径数组）和 `path`（第一个存在的文件路径，如果不存在则为 `undefined`）的对象。
- **使用示例**:
  ```typescript
  const result = await findJsEntry('src/main');
  // result.predictions 可能包含 ['src/main.js', 'src/main.ts', 'src/main.mjs', ...]
  // result.path 是实际存在的文件路径
  ```

#### `touch(filename: string): Promise<void>`
- **功能**: 创建一个文件，如果文件已存在，则更新其访问和修改时间戳。
- **参数**: `filename`: 文件路径。
- **返回值**: 无。
- **使用示例**:
  ```typescript
  await touch('dist/.gitkeep');
  ```

### JSON处理工具

JSON处理工具专注于处理小程序中常见的JSON配置文件，支持带注释的JSON（JSONC）和动态JSON生成。

**Section sources**
- [json.ts](file://packages/weapp-vite/src/utils/json.ts#L1-L113)

#### `parseCommentJson(json: string): any`
- **功能**: 解析包含注释的JSON字符串（JSONC格式）。
- **参数**: `json`: 要解析的JSON字符串。
- **返回值**: 解析后的JavaScript对象。
- **使用示例**:
  ```typescript
  const obj = parseCommentJson('{ "name": "example" } // 这是一个注释');
  ```

#### `stringifyJson(value: object, replacer?: (key: string, value: unknown) => unknown | Array<number | string> | null): string`
- **功能**: 将JavaScript对象序列化为格式化的JSON字符串。
- **参数**:
  - `value`: 要序列化的对象。
  - `replacer`: 可选的替换函数或数组，用于过滤或转换序列化过程中的值。
- **返回值**: 格式化后的JSON字符串（缩进为2个空格）。
- **使用示例**:
  ```typescript
  const jsonString = stringifyJson({ a: 1, b: 2 });
  // 返回 '{\n  "a": 1,\n  "b": 2\n}'
  ```

#### `resolveJson(entry: JsonResolvableEntry, aliasEntries?: ResolvedAlias[]): string`
- **功能**: 处理并解析JSON配置对象，支持路径别名解析和特定于小程序的配置转换（如子包入口文件扩展名修正）。
- **参数**:
  - `entry`: 包含JSON对象和路径信息的条目。
  - `aliasEntries`: 可选的路径别名映射数组。
- **返回值**: 处理并序列化后的JSON字符串。
- **使用示例**:
  ```typescript
  const processedJson = resolveJson({
    json: { usingComponents: { 'my-button': '@/components/Button' } },
    jsonPath: 'src/pages/index.json',
    type: 'page'
  }, aliasEntries);
  ```

### 正则表达式工具

正则表达式工具提供了一些实用的正则表达式和匹配函数，用于处理字符串和请求路径。

**Section sources**
- [regexp.ts](file://packages/weapp-vite/src/utils/regexp.ts#L1-L35)

#### `CSS_LANGS_RE: RegExp`
- **功能**: 一个正则表达式，用于匹配所有支持的CSS语言文件扩展名（如 `.wxss`, `.scss`, `.less` 等）。
- **使用示例**:
  ```typescript
  CSS_LANGS_RE.test('styles/main.wxss'); // 返回 true
  ```

#### `isCSSRequest(request: string): boolean`
- **功能**: 判断一个请求路径是否指向一个CSS文件。
- **参数**: `request`: 请求路径。
- **返回值**: 如果是CSS请求则返回 `true`，否则返回 `false`。
- **使用示例**:
  ```typescript
  isCSSRequest('app.wxss'); // 返回 true
  ```

#### `regExpTest(arr: (string | RegExp)[], str: string, options?: { exact?: boolean }): boolean`
- **功能**: 检查字符串 `str` 是否与数组 `arr` 中的任意一个字符串或正则表达式匹配。
- **参数**:
  - `arr`: 字符串或正则表达式的数组。
  - `str`: 要测试的字符串。
  - `options`: 可选配置对象，`exact: true` 表示进行精确匹配（完全相等）。
- **返回值**: 如果匹配则返回 `true`，否则返回 `false`。
- **使用示例**:
  ```typescript
  regExpTest(['components', 'widgets'], 'pages/components/index'); // 返回 true
  regExpTest([/\.js$/], 'main.js'); // 返回 true
  ```

### 版本处理工具

版本处理工具用于检查当前运行环境的版本是否满足最低要求。

**Section sources**
- [version.ts](file://packages/weapp-vite/src/utils/version.ts#L1-L64)

#### `checkRuntime(minVersions: MinVersions): void`
- **功能**: 检查当前Node.js、Deno或Bun运行时的版本是否满足指定的最低版本要求。如果不满足，会通过日志发出警告。
- **参数**: `minVersions`: 一个对象，指定了 `node`, `deno`, `bun` 的最低版本号。
- **返回值**: 无。
- **使用示例**:
  ```typescript
  checkRuntime({ node: '18.0.0', bun: '1.0.0' });
  // 如果当前Node.js版本低于18.0.0，会输出警告信息
  ```

### 小程序配置工具

小程序配置工具专门用于处理 `weapp-vite` 的配置文件。

**Section sources**
- [weappConfig.ts](file://packages/weapp-vite/src/utils/weappConfig.ts#L1-L57)

#### `resolveWeappConfigFile(options: ResolveWeappConfigFileOptions): Promise<string | undefined>`
- **功能**: 在指定目录中查找 `weapp-vite` 的配置文件（如 `weapp-vite.config.ts`, `weapp-vite.config.js` 等）。
- **参数**: `options`: 包含 `root`（根目录）和可选的 `specified`（指定的配置文件路径）的对象。
- **返回值**: 找到的配置文件的绝对路径，如果未找到则返回 `undefined`。
- **使用示例**:
  ```typescript
  const configPath = await resolveWeappConfigFile({ root: process.cwd() });
  ```

## 设计原则与性能考虑

weapp-vite 工具库的设计遵循了以下原则：

1.  **单一职责**: 每个函数只做一件事，并且做好它。例如，`changeFileExtension` 只负责修改扩展名，不涉及文件系统操作。
2.  **类型安全**: 使用TypeScript编写，提供了完整的类型定义，增强了代码的可读性和安全性。
3.  **异步友好**: 大多数涉及I/O操作的函数都返回Promise，符合现代JavaScript的异步编程范式。
4.  **健壮性**: 函数内部包含了充分的参数类型检查和错误处理，例如 `changeFileExtension` 会对输入参数进行类型验证。

在性能方面，工具库通过以下方式进行了优化：
- **缓存**: 对于频繁读取的文件，使用了LRU缓存（见 `packages/weapp-vite/src/plugins/utils/cache.ts`），避免重复的文件系统I/O操作。
- **高效算法**: 如 `regExpTest` 函数在匹配字符串时，会先检查长度和前缀，避免不必要的正则表达式执行。
- **轻量依赖**: 依赖的第三方库（如 `fs-extra`, `comment-json`）都是经过验证的轻量级库，避免了不必要的开销。

## 实际应用场景示例

这些工具函数在 `weapp-vite` 的插件开发和自定义脚本中有着广泛的应用。

**示例1：在插件中处理JSON配置**
```typescript
import { createJsonService } from 'weapp-vite';

// 创建JSON服务，用于读取和解析小程序的JSON配置文件
const jsonService = createJsonService(compilerContext);
const appJson = await jsonService.read('src/app.json');
```

**示例2：在构建脚本中检查环境**
```typescript
import { checkRuntime } from 'weapp-vite/utils';

// 在构建开始前，确保Node.js版本满足要求
checkRuntime({ node: '18.0.0' });
```

**示例3：动态生成文件路径**
```typescript
import { changeFileExtension, findJsEntry } from 'weapp-vite/utils';

// 根据页面路径动态查找对应的JS文件
const pagePath = 'src/pages/index';
const jsEntry = await findJsEntry(pagePath);
if (jsEntry.path) {
  const wxmlPath = changeFileExtension(jsEntry.path, '.wxml');
  // 继续处理WXML文件...
}
```

## 错误处理机制与边界情况

工具库对错误处理和边界情况给予了高度重视：

- **参数验证**: 关键函数会对输入参数进行严格验证。例如，`changeFileExtension` 会检查 `filePath` 和 `extension` 是否为字符串，如果不是则抛出 `TypeError`。
- **异常捕获**: 在文件I/O操作中，使用 `try...catch` 捕获可能的异常。例如，在 `touch` 函数中，如果 `utimes` 失败（文件不存在），则会尝试创建文件。
- **边界情况处理**:
  - `findJsEntry` 等查找函数在找不到文件时，会返回一个包含所有预测路径但 `path` 为 `undefined` 的对象，而不是抛出错误，这使得调用者可以优雅地处理文件缺失的情况。
  - `resolveJson` 函数会自动移除JSON中的 `$schema` 字段，这是小程序配置中的一个常见模式。
  - `regExpTest` 函数在传入非数组参数时会抛出 `TypeError`，防止了潜在的运行时错误。

通过这些机制，weapp-vite 的工具函数能够在各种复杂的开发环境中稳定可靠地运行。