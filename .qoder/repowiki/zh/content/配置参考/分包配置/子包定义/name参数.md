# name参数

<cite>
**本文档中引用的文件**   
- [subpackageSchema](file://@weapp-core/schematics/scripts/json.ts#L84-L90)
- [summarizeSubPackages](file://packages/weapp-vite/src/analyze/subpackages.ts#L523-L537)
- [independent-subpackage](file://packages/weapp-vite/test/fixtures/independent-subpackage/src/app.json.ts#L10)
- [subpackages.md](file://docs/subpackages.md)
- [website/config/subpackages.md](file://website/config/subpackages.md)
</cite>

## 目录
1. [引言](#引言)
2. [name参数的用途与最佳实践](#name参数的用途与最佳实践)
3. [命名规范建议](#命名规范建议)
4. [name参数与其他构建配置的交互关系](#name参数与其他构建配置的交互关系)
5. [结论](#结论)

## 引言
在微信小程序开发中，合理使用分包机制能够显著提升首屏加载速度和整体性能。`weapp-vite` 构建工具通过 `name` 参数为子包提供了更精细的控制能力。本文将详细说明 `subpackages` 配置中 `name` 参数的用途、最佳实践以及其对构建产物命名、代码分割和依赖管理的影响。

## name参数的用途与最佳实践
`name` 参数作为子包的唯一标识符，在 `weapp-vite` 的构建流程中起着关键作用。它不仅用于区分不同的子包，还影响构建产物的命名、代码分割策略及依赖管理。

### 唯一标识符
`name` 参数确保每个子包在整个项目中有唯一的标识。这有助于避免命名冲突，并使构建系统能够准确地识别和处理各个子包。

### 构建产物命名
`name` 参数直接影响构建产物的文件名。例如，在 `app.json` 中定义的子包：
```json
{
  "subPackages": [
    {
      "root": "packages/order",
      "name": "订单中心",
      "pages": ["index", "detail"],
      "independent": true
    }
  ]
}
```
这里的 `name` 参数“订单中心”会被用作构建产物的一部分，确保输出文件具有明确的语义。

### 代码分割
通过 `name` 参数，构建系统可以实现更高效的代码分割。每个子包的代码被独立打包，减少了主包的体积，从而加快了首屏加载速度。

### 依赖管理
`name` 参数还影响子包的依赖管理。对于独立子包（`independent: true`），`name` 参数帮助构建系统确定哪些依赖需要包含在该子包中，防止主包依赖泄漏到独立子包中。

**Section sources**
- [independent-subpackage](file://packages/weapp-vite/test/fixtures/independent-subpackage/src/app.json.ts#L10)
- [subpackages.md](file://docs/subpackages.md)

## 命名规范建议
为了最大化 `name` 参数的效果，遵循以下命名规范是至关重要的。

### 命名长度限制
建议 `name` 参数的长度不超过30个字符，以保持简洁性和可读性。

### 字符集要求
`name` 参数应仅包含字母、数字、中文字符和连字符（-）。避免使用特殊字符或空格，以确保兼容性和稳定性。

### 语义化命名原则
`name` 参数应具有明确的语义，反映子包的功能或业务领域。例如，“订单中心”、“用户中心”等名称直观地表达了子包的用途。

### 示例
```json
{
  "subPackages": [
    {
      "root": "packages/order",
      "name": "订单中心",
      "pages": ["index", "detail"]
    },
    {
      "root": "packages/profile",
      "name": "个人中心",
      "pages": ["index", "settings"]
    }
  ]
}
```

**Section sources**
- [subpackages.md](file://docs/subpackages.md)

## name参数与其他构建配置的交互关系
`name` 参数与多种构建配置相互作用，共同决定了最终的构建结果。

### chunk命名
`name` 参数与 `chunks.sharedStrategy` 配置结合使用，可以控制跨包共享模块的输出策略。例如，设置 `sharedStrategy: 'duplicate'` 可以避免主包和分包之间的重复模块。

### 缓存策略
`name` 参数也影响缓存策略。每个子包的 `name` 参数作为缓存键的一部分，确保不同子包的缓存不会相互干扰。

### 示例配置
```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
    subPackages: {
      'packages/order': {
        independent: true,
        dependencies: [/^@order\//, 'dayjs'],
        inlineConfig: {
          define: { 'import.meta.env.ORDER_SCOPE': 'true' },
        },
        styles: [
          'styles/theme.scss',
          {
            source: '../shared/styles/components.scss',
            scope: 'components',
            include: ['components/**'],
          },
        ],
      },
      'packages/profile': {
        styles: {
          source: 'styles/index.scss',
          scope: 'pages',
        },
      },
    },
    chunks: {
      sharedStrategy: 'duplicate',
      duplicateWarningBytes: 256 * 1024,
    },
  },
})
```

**Section sources**
- [website/config/subpackages.md](file://website/config/subpackages.md)

## 结论
`name` 参数在 `weapp-vite` 的分包配置中扮演着重要角色。通过合理使用 `name` 参数，开发者可以实现更高效的代码分割、更精确的依赖管理和更清晰的构建产物命名。遵循命名规范并结合其他构建配置，可以进一步优化小程序的性能和用户体验。