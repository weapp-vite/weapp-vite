# WeVu 综合示例应用

这是一个全面展示 WeVu 运行时框架所有功能的综合示例应用。

## 项目简介

本项目演示了如何在微信小程序中使用 Vue 3 的语法和特性，包括：

- 响应式系统（reactive、ref、computed、watch）
- 组件系统（Page、Component注册）
- 生命周期钩子
- Setup 组合式 API
- 状态管理
- 模板指令、事件、v-model、插槽等语法覆盖

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动开发服务器
pnpm dev

# 启动开发服务器并打开微信开发者工具
pnpm dev:open
```

### 构建生产版本

```bash
pnpm build
```

## 项目结构

```
src/
├── app.vue                    # 应用入口
├── pages/                     # 页面 demo（首页导航 + 功能页）
├── components/                # 页面内复用的 demo 组件
├── stores/                    # store 示例（含跨页面共享）
├── hooks/                     # PageFeatures 等 hooks
└── native/                    # 原生组件（互操作示例）
```

## 功能特性

### 1. 基础响应式（pages/basic）

- reactive 对象响应式
- ref 基本类型响应式
- 嵌套对象响应式
- 数组响应式操作

### 2. 计算属性（pages/computed）

- 只读计算属性
- 可写计算属性
- 链式计算属性
- 计算属性缓存机制

### 3. 侦听器（pages/watch）

- 基础 watch 用法
- 立即执行 immediate
- 深度侦听 deep
- 多数据源侦听

### 4. 生命周期（pages/lifecycle）

- 所有生命周期钩子演示
- 钩子执行顺序
- 多次注册同一钩子

### 5. Setup 语法（pages/setup）

- setup 函数基础用法
- 访问运行时上下文
- 组合多个功能

### 6. Script Setup（pages/vue-script-setup）

- script setup 语法糖
- 顶层变量自动暴露
- defineProps / defineEmits / defineExpose 等宏与写法覆盖

### 7. 表单与 v-model（pages/vue-v-model）

- 手动 :value + @input（对照）
- v-model 修饰符（lazy/number/trim）
- 自定义组件 v-model / v-model:arg

### 8. Vue 模板指令与列表（pages/vue-template）

- v-if/v-else/v-show/v-for/v-once/v-pre
- 列表过滤 + push/pop/reverse 等数组操作

### 9. 组件通信（pages/component）

- 父子组件通信
- 组件属性传递
- 自定义事件触发

### 10. 插槽（pages/slot）

- 默认插槽
- 具名插槽
- 作用域插槽
- 动态插槽名（v-slot / #）

### 11. 状态管理（pages/store）

- 定义和使用 store
  - state 状态访问
  - getters 计算状态
  - actions 方法调用
  - $patch/$state 变更订阅与插件扩展示例
  - 跨页面复用（pages/store-shared）：多个页面共享同一 store 实例

### 12. 高级特性（pages/advanced）

- 全局属性注册
- 插件系统使用
- 性能优化技巧

### 13. 编译时自动 PageFeatures（pages/auto-features）

- 仅在 `setup()` 里调用 wevu `onShareAppMessage/onPageScroll/...`（不写原生 `onXXX`、不手写 `features`）
- 将 hook 提炼到多个 TS 文件后仍可被 weapp-vite 编译期分析并自动注入 `features.enableOnXxx = true`
- 构建后可在 `dist/pages/auto-features/index.js` 搜索 `features` 验证注入结果

## 技术栈

- **运行时框架**: wevu
- **编译链路**: weapp-vite 内置 Vue SFC 支持
- **构建工具**: weapp-vite (基于 Vite 7)
- **开发语言**: TypeScript
- **小程序平台**: 微信小程序

## 注意事项

1. 确保已安装 Node.js 22+
2. 确保已安装 pnpm 10.26+
3. 开发前需要先构建 wevu 包
4. 使用微信开发者工具时，需要启用"服务端口"

## 相关链接

- [WeVu 文档](../../docs/wevu/)
- [weapp-vite 文档](../../website/)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)

## 实现进度

- [x] 项目基础结构和配置
- [x] 应用入口 (app.vue)
- [x] 首页导航 (pages/index)
- [x] 基础响应式示例 (pages/basic)
- [x] 计算属性示例 (pages/computed)
- [x] 侦听器示例 (pages/watch)
- [x] 生命周期示例 (pages/lifecycle)
- [x] 全生命周期 onXXX (pages/wevu-hooks)
- [x] 编译时自动 features (pages/auto-features)
- [x] Setup语法示例 (pages/setup)
- [x] Script Setup示例 (pages/vue-script-setup)
- [x] 表单与 v-model (pages/vue-v-model)
- [x] Vue 模板指令与列表 (pages/vue-template)
- [x] 组件通信示例 (pages/component)
- [x] 插槽示例 (pages/slot)
- [x] 状态管理示例 (pages/store)
- [x] 高级特性示例 (pages/advanced)
- [ ] 可复用组件 (后续完善)

## 运行说明

### 前置条件

1. 确保已安装依赖:

   ```bash
   cd /Users/icebreaker/Documents/GitHub/weapp-vite
   pnpm install
   ```

2. 构建必需的包:

   ```bash
   pnpm --filter wevu build
   ```

3. 进入示例项目目录:

   ```bash
   cd apps/wevu-comprehensive-demo
   ```

4. 启动开发服务器:
   ```bash
   pnpm dev
   ```

### 使用微信开发者工具

1. 打开微信开发者工具
2. 导入项目，选择 `apps/wevu-comprehensive-demo` 目录（`project.config.json` 的 `miniprogramRoot` 指向 `dist/`）
3. 确保开启"服务端口"设置
4. 开始体验各个功能示例

### 功能验证

所有示例页面都已实现基础功能，包括：

1. **基础响应式** - 演示 reactive 对象、ref 基本类型和数组的响应式特性
2. **计算属性** - 展示只读计算属性和购物车计算逻辑
3. **侦听器** - 演示基础 watch、immediate 和 deep 选项
4. **生命周期** - 完整的生命周期钩子演示和日志记录
5. **Setup语法** - Setup 函数与 Options API 结合使用
6. **Script Setup** - 更简洁的 script setup 语法糖
7. **表单绑定** - 各类表单控件的双向绑定
8. **列表渲染** - 待办事项列表的完整CRUD操作
9. **组件通信** - 父子组件通信基础示例
10. **状态管理** - 局部状态管理示例
11. **高级特性** - 高级功能特性列表

## 许可证

MIT
