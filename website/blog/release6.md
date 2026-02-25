# 还在硬扛原生小程序？试试 weapp-vite / wevu

你可能正处在这个状态：

- 原生小程序能跑，但开发效率一直提不上来
- 想用 Vue 的开发体验，又担心“换框架 = 重做项目”
- 团队有人懂原生、有人懂 Vue，技术路线很难统一

如果你有这些痛点，这篇文章只讲一件事：
**用更低迁移成本，把小程序开发体验升级到现代前端。**

`weapp-vite` + `wevu`，就是当前这条路径里非常实用的一组组合。

---

## 一句话先讲清：它们分别做什么

- `weapp-vite`：负责工程化和编译链路（构建、开发体验、项目组织）
- `wevu`：负责 Vue 3 风格运行时（`ref`、`computed`、`watch`、生命周期等）

可以把它理解成：

- 你继续写小程序业务
- 工具链和运行时把“费劲的部分”接走
- 团队能在原生路线和 Vue 路线之间灵活选择

这套组合的关键不是“炫技”，而是**把上手门槛降到很低**。

---

## 为什么现在值得上手（推广重点）

### 1. 不用全量重构，能渐进迁移

很多方案卡在第一步：要么全换、要么别动。

`weapp-vite / wevu` 的实际价值是：

- 原生页面可以继续保留
- 新页面可以直接用 Vue SFC + wevu
- 老项目可以按页面逐步迁移，而不是一次性推翻

对业务团队来说，这比“理论最优”更重要。

### 2. 一套体系覆盖两种开发习惯

当前仓库脚手架已经提供了完整模板选择：

- 原生模板
- wevu（Vue SFC）模板
- `tailwindcss` / `tdesign` / `vant` / `wevu-tdesign` 等组合模板

这意味着你不需要在团队内部争“到底全员原生还是全员 Vue”。

先跑起来，再按收益扩展。

### 3. 现代工程体验直接给到位

从现在仓库文档和模板来看，主链路已经是“开箱即用”的状态：

- TypeScript、Sass/Less、PostCSS、Tailwind CSS
- Vite 配置方式与插件生态
- 自动构建 `miniprogram_npm`
- 自动组件注册（模板内已示例）
- `pnpm dev --open` / `pnpm open` 联动微信开发者工具

你会明显感受到：不是业务变简单了，而是**日常开发阻力变小了**。

### 4. wevu 学习成本对 Vue 团队非常友好

wevu 的 API 设计对齐 Vue 3 常见心智：

- `ref` / `reactive` / `computed` / `watch`
- 生命周期 hooks（`onLoad`、`onShow`、`onMounted` 等）
- 内置 store API（`defineStore` / `storeToRefs`）

同时保持小程序环境特性，不引入 Virtual DOM，底层通过快照 diff 尽量减少 `setData` 负担。

一句话：**写法像 Vue，落地是小程序。**

---

## 你应该怎么选

### 选 `weapp-vite`（偏原生）

适合你如果：

- 要最大化贴近微信官方原生体系
- 存量原生代码很多，优先升级工程化
- 希望尽量少改业务语法

### 选 `weapp-vite + wevu`（偏 Vue）

适合你如果：

- 团队已经熟悉 Vue 3 + Composition API
- 页面交互复杂，状态管理成本高
- 希望在小程序内获得更高的组件复用效率

大多数团队的最佳路线是：
**先全量接入 weapp-vite，再局部引入 wevu。**

---

## 3 分钟启动一个可跑项目

> Node 版本要求：`^20.19.0 || >=22.12.0`

### 1) 创建项目

交互式创建：

```bash
pnpm create weapp-vite
```

直接创建 wevu 模板：

```bash
pnpm create weapp-vite my-app wevu
```

### 2) 安装依赖

```bash
cd my-app
pnpm i
```

### 3) 启动开发

```bash
pnpm dev
```

如果微信开发者工具已开启服务端口：

```bash
pnpm dev --open
```

或手动打开：

```bash
pnpm open
```

到这里，你就已经进入“可持续迭代”的开发状态了。

---

## 代码体验：为什么说它门槛低

下面就是一个 wevu 页面的最小示例：

```vue
<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: '首页',
})

const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value += 1
}
</script>

<template>
  <view>
    <text>count: {{ count }}</text>
    <text>doubled: {{ doubled }}</text>
    <button @tap="increment">+1</button>
  </view>
</template>
```

这段代码基本能说明一切：

- 写法是 Vue 3 熟悉的方式
- 模板仍是小程序语义
- 编译和运行由 `weapp-vite + wevu` 自动配合

团队不用先学一套全新 DSL，就能把效率提起来。

---

## 老项目怎么落地（实战建议）

### 第一步：只换构建链，不动业务

先用 weapp-vite 跑通开发、构建、打开 IDE 的日常流程。

### 第二步：选 1~2 个页面试点 wevu

优先迁移：

- 交互最复杂、状态最多的页面
- 新增业务页面（避免触碰核心稳定页）

### 第三步：按收益逐步扩展

如果试点后收益明确（开发效率、可维护性、交付速度），再扩大 wevu 覆盖范围。

这条路线的优势是：
**风险小、成本可控、团队更容易达成共识。**

---

## 快速 FAQ

### Q1：用了 wevu，还能继续使用小程序原生能力吗？

可以。wevu 是运行时增强，不是替换小程序生态。

### Q2：必须全项目都改成 Vue SFC 吗？

不需要。可以只在部分页面使用 wevu。

### Q3：脚手架创建后，`weapp-vite` 和 `wevu` 版本会乱吗？

当前脚手架会自动对齐模板依赖版本，减少手动对版本的维护成本。

---

## 最后：如果你只记住一句话

- 想保留原生心智，但要更现代的开发体验：选 **weapp-vite**。
- 想在小程序里低门槛使用 Vue 3 风格开发：选 **weapp-vite + wevu**。

现在仓库里的模板、编译链路、运行时和文档都已经配套到位。

从 `pnpm create weapp-vite` 开始，你可以很快拿到一个“能上线、能维护、能持续迭代”的小程序工程。

如果你正在评估下一代小程序技术栈，这就是一条可以马上验证的路线。
