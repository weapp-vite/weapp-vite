---
"weapp-vite": major
---

## 重构 Vue 支持架构

将 Vue SFC 支持完全集成到 `weapp-vite` 内部。

### 主要变更

- ✅ **删除外置的 Vue 编译插件包**
  - 核心功能已完全迁移到 weapp-vite
  - 不再需要单独的 Vue 插件

- ✅ **weapp-vite 内置 Vue 支持**
  - 自动处理 `.vue` 文件
  - 支持完整的 Vue SFC 编译
  - 支持 JS/TS 配置块
  - 更健壮的 Babel AST 转换

- ✅ **Runtime API 导出**
  - `createWevuComponent` 可从 `weapp-vite` 和 `weapp-vite/runtime` 导入
  - 完整的 TypeScript 类型支持

### 迁移指南

**之前（使用外置插件）：**
```typescript
export default defineConfig({
  plugins: [/* 旧 Vue 插件 */],
})
```

**现在（内置支持）：**
```typescript
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
  // Vue 文件自动处理，无需额外配置
})
```

### Breaking Changes

- 移除了外置 Vue 编译插件
- demo 项目不再需要 pre 脚本来构建依赖
- 依赖简化：`demo → weapp-vite → wevu`

### 测试

所有 81 个测试通过 ✅
