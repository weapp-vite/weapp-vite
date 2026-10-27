# @weapp-vite/glass-easel-web-adapter

实验性的 glass-easel Web 组件后端。它使用官方组件树、模板编译器和浏览器 backend，提供独立的组件注册、挂载、数据更新、事件和生命周期桥接。

每个 adapter 持有自己的 `ComponentSpace`。`usingComponents` 声明组件依赖，父模板中的默认和命名 slot 由官方组件树处理，投影内容随父级数据更新，并保留其事件处理上下文。注册支持 `data`、`properties`、`methods`、`observers`、`options` 和 `lifetimes`。

## 组件树示例

在浏览器入口显式创建 adapter：

```ts
import { createGlassEaselWebAdapter } from '@weapp-vite/glass-easel-web-adapter'

const adapter = createGlassEaselWebAdapter()

adapter.registerComponent({
  name: 'demo',
  usingComponents: { counter: '/counter' },
  data: { title: '计数器', last: 0 },
  template: `
    <counter label="{{title}}" bind:change="changed">
      <b slot="heading">{{title}}</b>
      <span>已提交 {{last}}</span>
    </counter>
  `,
  methods: {
    changed(event: { detail: { value: number } }) {
      this.setData({ last: event.detail.value })
    },
  },
})

adapter.registerComponent({
  name: 'counter',
  properties: { label: String },
  data: { count: 0 },
  options: { multipleSlots: true },
  template: `
    <section>
      <header><slot name="heading" /></header>
      <button bind:click="increment">{{label}}：{{count}}</button>
      <slot />
    </section>
  `,
  methods: {
    increment() {
      const value = this.data.count + 1
      this.setData({ count: value })
      this.triggerEvent('change', { value })
    },
  },
})

const container = document.createElement('div')
document.body.append(container)
const instance = adapter.mountComponent('demo', container)

adapter.updateComponent(instance, { title: '新的标题' })
console.log(adapter.getSnapshot(instance))

// 宿主页面卸载时调用；重复清理不会重复触发 detached。
export function cleanup() {
  adapter.dispose()
  container.remove()
}
```

可以先注册父组件，再注册子组件；挂载前必须完成整棵树的依赖注册。组件名使用项目内的 POSIX 组件路径，例如 `components/counter`；注册与挂载统一规范化前导 `/`、`.` 和路径内的 `..`，拒绝越出组件空间的路径、反斜杠、query、hash 与 URL scheme。`usingComponents` 支持官方的绝对和相对组件引用。方法与生命周期回调中的 `this` 是官方 core 的 `GeneralComponent`，并非完整的小程序 API adapter。

## 实例与资源所有权

- `mountComponent` 返回只读的 `GlassEaselWebInstance` 句柄；更新、触发事件、卸载和读取快照都要求由同一个 adapter 创建的实例，不能用普通对象代替。
- `updateComponent` 交给官方 `setData`，支持数据路径更新。快照读取实际组件数据，因此能观察到方法内部的更新；容器值使用官方深复制隔离快照，函数值保持可调用。列表重排由官方 keyed 更新保留节点身份。
- 同一个容器可以挂载多个实例，卸载只移除对应的根节点，保留已有兄弟内容。`virtualHost` 根组件由具有实体根节点的内部父组件承载。
- `unmountComponent` 递归触发官方组件树的 `detached` 并释放 backend 节点；`dispose` 清理 adapter 的全部挂载实例。二者可以重复调用，已卸载实例仍可读取快照。
- 官方 DOM backend 的事件委托监听绑定到 `document.body`，其 `destroy()` 没有提供移除这些监听的实现。adapter 按文档共享同一个 backend，避免多个根或 adapter 重复派发同一浏览器事件，只向官方树中仍挂载的节点派发。已卸载节点即使重新插入 DOM 也不再处理事件；文档级监听保留到文档销毁，不属于单个实例的卸载范围。

旧的第四个 `slots` 参数继续接受调用方控制的模板字符串，但现在会编译成真实父组件的 WXML，由官方 slot 机制投影，更新时不会再手工替换 DOM。需要父级作用域和事件处理的动态 slot 时，使用上面的父子组件模板写法。模板字符串应来自可信的应用源码。

## 当前范围

这是独立的组件后端实验，尚未接入 `wv dev -p web` / `wv build -p web` 的默认 runtime，也没有新增 renderer 配置。页面路由、WXSS/rpx、微信 API 和小程序原生组件适配仍由后续 Web host 集成承担。

当前注册阶段仍在浏览器中调用含 WASM 的模板编译器；生产接入前需要拆出构建期编译入口。官方 core 挂载会触发 `created` / `attached`，卸载会触发 `detached`；`ready` 需要宿主在渲染提交后驱动，当前 adapter 不自动补发。本阶段的浏览器验证不代表微信 DevTools、真机或六个平台的行为已达成一致。

所有模式都要求可用的官方 DOM backend；旧 `strict` 选项仅保留调用兼容，已移除字符串渲染降级。

## 验证

```bash
pnpm --filter @weapp-vite/glass-easel-web-adapter typecheck
pnpm --filter @weapp-vite/glass-easel-web-adapter test
pnpm --filter @weapp-vite/glass-easel-web-adapter test:types
pnpm --filter @weapp-vite/glass-easel-web-adapter test:browser
pnpm --filter @weapp-vite/glass-easel-web-adapter build
```

包级测试覆盖组件空间隔离、真实 slot、属性与 observer、路径更新、列表节点身份和递归卸载；浏览器测试使用构建后的包，在一个页面中验证多实例、真实点击和组件事件，并在结束时关闭测试浏览器与服务。
