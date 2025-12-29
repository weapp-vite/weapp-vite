# Runtime API 使用指南

`weapp-vite` 导出了 Vue Runtime API，让你可以在外部直接使用 `createWevuComponent` 和相关类型。

## 导出的 API

### 函数

- **`createWevuComponent`** - 创建 WeVu 组件或页面

### 类型

- **`WevuComponentOptions`** - 组件配置选项类型
- **`ComputedDefinitions`** - 计算属性定义类型（来自 `wevu`）
- **`MethodDefinitions`** - 方法定义类型（来自 `wevu`）
- **`Ref`** - Ref 类型（来自 `wevu`）

## 使用示例

### 基础用法

```typescript
import { createWevuComponent } from 'weapp-vite'

// 创建一个组件
createWevuComponent({
  data() {
    return {
      count: 0,
      message: 'Hello World'
    }
  },
  computed: {
    doubleCount() {
      return this.count * 2
    }
  },
  methods: {
    increment() {
      this.count++
    }
  }
})
```

### 创建页面

```typescript
import { createWevuComponent } from 'weapp-vite'

createWevuComponent({
  data() {
    return {
      pageTitle: 'My Page',
      items: []
    }
  },
  methods: {
    onLoad() {
      console.log('Page loaded')
    }
  }
})
```

### 使用 TypeScript 类型

```typescript
import type { ComputedDefinitions, MethodDefinitions, WevuComponentOptions } from 'weapp-vite'
import {

  createWevuComponent

} from 'weapp-vite'

interface MyData {
  count: number
  message: string
}

const options: WevuComponentOptions<MyData> = {
  data() {
    return {
      count: 0,
      message: 'Hello'
    }
  },
  computed: {
    doubleCount(): number {
      return this.count * 2
    }
  } as ComputedDefinitions<MyData>,
  methods: {
    increment() {
      this.count++
    }
  } as MethodDefinitions
}

createWevuComponent(options)
```

### 高级用法：组合式 API

```typescript
import { createWevuComponent } from 'weapp-vite'

createWevuComponent({
  setup() {
    // 使用 setup 语法
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    return {
      count,
      doubled
    }
  }
})
```

## 类型定义

### WevuComponentOptions

```typescript
interface WevuComponentOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions
> {
  type?: 'page' | 'component' // 默认为 'page'
  data?: () => D
  computed?: C
  methods?: M
  watch?: any
  setup?: (...args: any[]) => any
  [key: string]: any
}
```

## 注意事项

1. **运行时依赖**：使用 `createWevuComponent` 需要确保项目中已安装 `wevu` 包

2. **类型支持**：所有导出的类型都提供了完整的 TypeScript 类型支持

3. **与 Vue SFC 的关系**：
   - 在 `.vue` 文件中，`createWevuComponent` 会自动被调用
   - 手动调用时，确保不要重复注册

## 相关文档

- [Vue SFC 支持](../test/vue/README.md)
- [wevu 文档](https://github.com/weapp-vite/wevu)
