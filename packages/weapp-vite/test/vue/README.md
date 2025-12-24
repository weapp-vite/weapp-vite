# Vue SFC Support for weapp-vite

完整的 Vue 单文件组件（SFC）支持，将 Vue 3 语法编译为微信小程序代码。

## 功能特性

### ✅ 已实现的功能

#### 1. 模板编译 (Template Compilation)

- **结构指令**
  - `v-if`, `v-else-if`, `v-else` → `wx:if`, `wx:elif`, `wx:else`
  - `v-for` → `wx:for`
  - 支持复杂语法: `(item, key, index) in list`

- **属性绑定**
  - `v-bind:attr` / `:attr` → `attr="{{...}}"`
  - `v-on:event` / `@event` → `bind{event}="..."`
  - 事件映射: `@click` → `bindtap`

- **双向绑定**
  - `input` (text) → `value` + `bind:input`
  - `input` (checkbox) → `checked` + `bind:change`
  - `input` (radio) → `checked` + `bind:change`
  - `textarea` → `value` + `bind:input`
  - `select` → `value` + `bind:change`
  - `switch` → `checked` + `bind:change`
  - `slider` → `value` + `bind:change`
  - `picker` → `value` + `bind:change`

- **其他指令**
  - `v-show` → `style` 属性
  - `v-text` → `{{...}}`
  - 自定义指令 → `data-v-*` 属性

#### 2. 样式处理 (Style Processing)

- **CSS 到 WXSS 转换**
  - 单位转换: `rem`, `vw`, `vh` → `rpx`
  - 移除不支持的伪类警告

- **Scoped CSS**
  - 自动添加 `data-v-xxx` 属性
  - 支持多行 CSS 规则
  - 选择器 scoped 转换

- **CSS Modules**
  - 自动生成唯一的类名
  - 导出 `$style` 对象
  - 支持自定义模块名

#### 3. 插槽系统 (Slot System)

- **默认插槽**: `<slot></slot>`
- **具名插槽**: `<slot name="header"></slot>`
- **插槽内容**: `<template v-slot:header>` → `<template slot="header">`
- **作用域插槽**: `<template v-slot="props">` (需要运行时支持)
- **Fallback 内容**: `<slot>默认内容</slot>`

#### 4. 高级特性 (Advanced Features)

- **动态组件**: `<component :is="currentView">`
  - 使用 `data-is` 属性
  - 支持属性传递

- **过渡动画**: `<transition>`
  - 渲染子元素
  - 需要动画库支持

- **Keep-Alive**: `<keep-alive>`
  - 使用 `data-keep-alive` 标记
  - 需要运行时状态管理

#### 5. 脚本编译 (Script Compilation)

- 支持 `<script setup>`
- 支持 TypeScript
- 生成 wevu 组件格式
- 自动导入 `createWevuComponent`

#### 6. 自定义块 (Custom Blocks)

- `<config>` 块支持
- 生成 `project.config.json`

## 测试覆盖

- **73 个测试** 全部通过
- **85.04%** 代码覆盖率
- 测试分类:
  - 基础模板编译 (39 tests)
  - 样式处理 (13 tests)
  - 高级特性 (12 tests)
  - E2E 集成测试 (9 tests)

## 示例组件

查看 `ExampleComponent.vue` 获取完整示例，包含:

- 状态管理 (ref, computed)
- 列表渲染 (v-for)
- 条件渲染 (v-if/v-else)
- 表单输入 (v-model)
- 事件处理 (@click, @tap)
- 动态组件
- 过渡动画
- Scoped CSS
- 自定义配置

## 使用方法

### 1. 配置插件

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import weappVite from '@weapp-vite/vite'

export default defineConfig({
  plugins: [
    weappVite({
      vue: {
        enable: true,
        template: {
          removeComments: true,
        },
      },
    }),
  ],
})
```

### 2. 创建 Vue SFC

```vue
<template>
  <view class="container">
    <text>{{ message }}</text>
    <button @click="handleClick">Click</button>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const message = ref('Hello weapp-vite!')
const handleClick = () => {
  console.log('Button clicked!')
}
</script>

<style scoped>
.container {
  padding: 20rpx;
}
</style>
```

### 3. 编译输出

编译后生成:
- `.js` - JavaScript 代码
- `.wxml` - 模板代码
- `.wxss` - 样式代码
- `.json` - 配置文件

## 限制与注意事项

1. **运行时依赖**: 需要配合 `@weapp-vite/plugin-wevu/runtime` 使用
2. **过渡动画**: 需要额外的动画库支持
3. **动态组件**: 需要 `data-is` 运行时支持
4. **Keep-Alive**: 需要状态管理支持
5. **复杂 CSS**: 某些 CSS 特性在小程序中不支持

## 测试

```bash
# 运行所有测试
pnpm test test/vue/

# 运行特定测试
pnpm test test/vue/compiler.test.ts
pnpm test test/vue/style.test.ts
pnpm test test/vue/advanced.test.ts
pnpm test test/vue/e2e.test.ts

# 查看覆盖率
pnpm test --coverage test/vue/
```

## 相关文档

- [Vue 3 官方文档](https://vuejs.org/)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [weapp-vite 核心架构](/docs/core-architecture.md)

## 贡献

欢迎提交 Issue 和 Pull Request！
