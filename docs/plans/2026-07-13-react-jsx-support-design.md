# weapp-vite React / JSX 支持设计

## 1. 结论

weapp-vite 若要支持标准 React 19、函数组件和 Hooks，应该采用与 Taro 3/4 同类的运行时渲染架构：

1. JSX/TSX 只转换为标准 React element 调用，不静态翻译成页面专属 WXML。
2. `react-reconciler` 将 Fiber mutation 写入一棵小程序宿主节点树。
3. 宿主节点树压缩为可被通用 WXML 消费的数据协议。
4. React commit 产生路径级 `setData` payload。
5. 页面 WXML 只负责按节点类型渲染通用树，事件统一代理回 React runtime。

现有 Wevu JSX 编译器不能直接承担这项能力。它把可静态识别的 `render()`、条件表达式和 `map()` 翻译成 WXML，并移除脚本中的 JSX；这适合 Wevu 的静态模板模型，但无法覆盖任意函数组件组合、Hooks、Context、运行时 children、Suspense 或标准 React 调度语义。

推荐借鉴 Taro 的边界设计，但不直接依赖 `@tarojs/runtime`、`@tarojs/react` 或 Taro runner。直接复用这些包会同时引入 Taro 的 DOM/BOM、组件目录、平台插件、编译配置、生命周期 hook 和构建入口约定，相当于在 weapp-vite 内嵌另一套框架。

首版范围定为：

- React 19.2.x 与 `react-reconciler` 0.33.x。
- SWC Rust React Compiler 作为显式可选优化，Oxc 保留为 JSX-only baseline。
- 微信小程序。
- 函数组件、Hooks、Context、Fragments、class component、key、ref、错误边界。
- 小程序宿主组件、事件、页面生命周期和原生自定义组件桥接。
- 支付宝和抖音只预留平台适配边界，不在首版同时交付。

## 2. 当前仓库诊断

### 2.1 已有 JSX 不是 React JSX

`@wevu/compiler` 已有 `compileJsxFile`：

- 解析默认导出的 `defineComponent` 或对象组件。
- 静态提取 `render()`。
- 将 JSX element、条件表达式、逻辑表达式和 `array.map()` 编译为 WXML。
- 收集 inline handler 和自动组件信息。
- 从最终脚本移除 `render` 属性，再进入 Wevu 脚本转换。

这条链路依赖“模板可静态提取”这一前提。以下 React 代码没有稳定的页面专属静态模板：

```tsx
function Panel({ renderer }: { renderer: () => React.ReactNode }) {
  const [visible, setVisible] = useState(true)
  return visible ? renderer() : null
}
```

如果继续扩大静态 JSX 编译器，会逐渐重新实现 React 的组件求值、Hooks 调度和 reconciliation，最终仍需要一个 React runtime，而且静态编译与运行时语义会互相补丁化。

### 2.2 `.jsx/.tsx` 当前由 Vue/Wevu 插件拥有

当前实现把 `.vue`、`.jsx`、`.tsx` 统一称为 Vue-like entry：

- Vue resolver 会解析这三种扩展名。
- Vue transform filter 会处理 `.jsx/.tsx`。
- entry loader 将 `.jsx/.tsx` 当作无需原生 WXML sidecar 的页面入口。
- `jsExtensions` 仍只有 `ts/js`，JSX entry 的存在依赖 Vue-like 特殊路径。

因此 React 支持的第一个根因问题不是 JSX parser，而是“谁拥有 `.jsx/.tsx`”。不能通过检查源码是否包含 `react` import 来猜测，原因包括：

- JSX runtime 可能由自动转换注入，源码没有显式 `react` import。
- 组件可能只从内部库导入。
- re-export 和 barrel 会让判断依赖完整模块图。
- HMR 时 import 变化可能导致同一文件在两个编译器之间切换。

应该建立一个明确的 JSX owner：

```ts
type WeappJsxOwner = 'wevu' | 'react'
```

`weapp.react` 显式启用时，整个项目的 `.jsx/.tsx` 由 React 插件拥有；未启用时保持当前 Wevu JSX 行为。首版不支持同一构建中混用 React TSX 和 Wevu TSX。

### 2.3 可以复用的 weapp-vite 能力

React 插件不需要复制以下能力：

- app/pages/subPackages/plugin entry scan。
- JSON、CSS、WXS、资产处理。
- Rolldown chunk emit 和 output finalizer。
- npm 构建与依赖落位。
- 多平台输出扩展名。
- HMR entry invalidation、共享 chunk 归因和 dirty entry 发射。
- `prepare` 管理的 TypeScript 配置。
- analyze、MCP、screenshot、compare 和 IDE logs。

React 支持应作为新的框架适配层接入这些服务，而不是新建第二套 runner。

## 3. Taro 4.2 源码调研

调研基于 2026-07-13 npm 发布的 Taro 4.2.0：

- `@tarojs/react@4.2.0`
- `@tarojs/runtime@4.2.0`
- `@tarojs/vite-runner@4.2.0`
- `@tarojs/plugin-platform-weapp@4.2.0`

### 3.1 React Reconciler

`@tarojs/react` 依赖 `react-reconciler@0.29.0`，HostConfig 的主要行为是：

- `createInstance` 创建 Taro element。
- `createTextInstance` 创建 text node。
- `appendChild`、`insertBefore`、`removeChild` 修改运行时树。
- `prepareUpdate` 比较 props。
- `commitUpdate` 更新宿主属性和 Fiber props。
- `commitTextUpdate` 更新文本。
- 事件按 React event priority 进入 reconciler。

这说明 React 支持的核心不是 Babel JSX transform，而是一个完整、版本匹配的 HostConfig。

### 3.2 Runtime DOM 与 `setData`

`@tarojs/runtime` 维护 DOM-like 节点和紧凑序列化字段。root 收集 mutation payload，随后：

- 初次渲染使用页面级 `setData`。
- 后续更新按数据路径发送。
- child array 被替换时折叠更深层路径。
- 命中 `custom-wrapper` 时，把更新分区到 wrapper 自己的 `setData`。
- 同一 wrapper 的更新合并成一次调用。

Taro 的 DOM/BOM 兼容面很广，但 weapp-vite 首版没有必要复制浏览器 DOM。React HostConfig 只需要满足 React renderer 和小程序组件协议。

### 3.3 通用模板

Taro Vite runner 会通过 bundler emit：

- 页面 wrapper WXML。
- `base.xml` 通用模板。
- 不支持模板递归的平台使用的 `comp` 组件。
- `custom-wrapper` 组件。
- WXS/SJS helper。

微信不支持模板自递归，因此 Taro 默认展开多层模板；达到 `baseLevel` 后使用组件重新开始模板循环。这不是历史包袱，而是动态运行时树在微信模板能力下的必要适配。

### 3.4 体积参考

以下是 npm 包中已构建文件的直接大小，不是等价应用构建结果，只用于判断能力面的量级：

| 文件                                  |  原始大小 |     gzip |
| ------------------------------------- | --------: | -------: |
| `@tarojs/react/dist/react.esm.js`     |  35,807 B |  9,717 B |
| `@tarojs/runtime/dist/runtime.esm.js` | 200,536 B | 46,988 B |
| `@tarojs/shared/dist/template.js`     |  53,774 B | 12,589 B |

直接引入 Taro runtime 并不会自动得到轻量 React 支持，因为通用模板、组件 catalog 和平台插件仍然需要一起接入。

## 4. 路线比较

| 路线                                 | React 语义 |       工程成本 | 运行时体积 | 与 weapp-vite 边界            | 结论   |
| ------------------------------------ | ---------- | -------------: | ---------: | ----------------------------- | ------ |
| 扩展现有静态 JSX 编译                | 受限       |         中到高 |         低 | 会继续扩大 Wevu compiler 职责 | 不采用 |
| 直接嵌入 Taro runtime/runner         | 高         | 初期低、长期高 |         高 | 构建和平台所有权重叠          | 不采用 |
| 独立 React reconciler + 小程序宿主树 | 高         |             高 |       可控 | 可复用现有构建服务            | 推荐   |

静态编译仍可作为未来优化，例如对常量 class、host component 使用情况和原生组件引用做 analysis，但不能成为 React 正确性的基础。

## 5. 推荐架构

```text
app.tsx / page.tsx
        |
        v
Oxc JSX baseline / SWC Rust React Compiler
        |
        v
React 19 + react-reconciler 0.33
        |
        v
@weapp-vite/react HostConfig
        |
        v
MiniProgram Host Tree
  sid / nn / cn / v / cl / st / p
        |
        +------------------+
        |                  |
        v                  v
path-level setData     delegated events
        |                  |
        v                  v
generic WXML          React event priority
```

### 5.1 包与模块所有权

新增运行时包：

```text
packages-runtime/weapp-react/
  package name: @weapp-vite/react
```

职责：

- React HostConfig。
- 宿主节点树和序列化。
- commit payload 调度。
- 事件注册和 dispatch。
- React 页面生命周期 hooks。
- 小程序 host components 和 JSX 类型。

构建侧保留在：

```text
packages/weapp-vite/src/plugins/react/
```

职责：

- JSX owner 和 entry resolution。
- app/page/component virtual entry。
- Oxc TSX transform 配置。
- 通用 WXML/WXS/辅助组件 emit。
- 页面 JSON 和 native component catalog 对接。
- HMR 与 React Refresh 接入。

不新增独立的 `@weapp-vite/react-compiler` 包。通用模板生成依赖 weapp-vite 的平台、entry、JSON 和 emit context，放到运行时包会形成反向依赖；React Compiler transform 直接复用构建侧的 SWC 能力。

跨运行时和构建端共享的协议字段放入 `@weapp-core/constants`，包括：

- root data key。
- 节点字段名。
- event handler method name。
- dataset sid key。
- virtual module marker。

### 5.2 公共配置

首版新增：

```ts
export interface WeappReactConfig {
  compiler?: boolean | WeappReactCompilerConfig
  enable?: boolean
  runtime?: 'auto' | 'dev' | 'build'
  devWarnings?: boolean
}

export interface WeappReactCompilerConfig {
  compilationMode?: 'infer' | 'syntax' | 'annotation' | 'all'
  engine?: 'swc'
}

export interface WeappViteConfig {
  react?: boolean | WeappReactConfig
}
```

默认值：

- `react: undefined/false`：保持现有行为，`.jsx/.tsx` 归 Wevu JSX。
- `react: true`：启用 React，开发构建使用可诊断 runtime，生产构建使用 production runtime。
- `compiler: false`：首版默认，使用 Oxc automatic JSX transform。
- `compiler: true`：使用 SWC Rust React Compiler，默认 `compilationMode: infer`。
- `runtime: auto`：dev 使用 dev，build 使用 build。
- `devWarnings: true`：开发态报告不支持的 host prop、未知 host component、模板深度回退和超大 payload。

首版不暴露 `baseLevel`、payload merge threshold 或 custom-wrapper 策略。这些配置会把内部协议变成公共负担，应先通过真实 profile 确认需要用户调节。

### 5.3 用户代码

页面：

```tsx
import { Button, Text, View } from '@weapp-vite/react'
import { useState } from 'react'

export default function IndexPage() {
  const [count, setCount] = useState(0)

  return (
    <View>
      <Text>{count}</Text>
      <Button onTap={() => setCount(value => value + 1)}>increment</Button>
    </View>
  )
}
```

app：

```tsx
import type { PropsWithChildren } from 'react'

export default function App({ children }: PropsWithChildren) {
  return children
}
```

构建插件自动生成 `App()` / `Page()` 注册代码。用户不手写 renderer mount，也不接触 root data key。

公开 API 使用 `View/Text/Button/Input` 等组件，而不是鼓励 `<view>`：

- 避免与 `@types/react` 的 DOM `button/input` intrinsic types 冲突。
- 便于生成完整的小程序 prop/event 类型。
- 便于构建期收集实际使用的 host component，裁剪通用 WXML。
- 便于平台组件差异和 deprecated prop 诊断。

运行时内部仍以字符串 host type 驱动 reconciler。

### 5.4 JSX 与 TypeScript

React 插件必须在 Vue/Wevu JSX transform 之前声明 `.jsx/.tsx` 所有权。建议新增 framework entry registry，避免继续在 core 中写死 Vue-like：

```ts
interface FrameworkEntryAdapter {
  extensions: readonly string[]
  owner: 'vue' | 'wevu-jsx' | 'react'
  resolveEntry: (base: string) => Promise<string | undefined>
}
```

`wv prepare` 检测到 `@weapp-vite/react` 时，为 app tsconfig 生成：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

未启用 compiler 时，构建转换使用 Vite 8 的 `transformWithOxc` 或等价 Oxc plugin，不新增 Babel JSX 热路径，也不使用已废弃的 `transformWithEsbuild`。

启用 compiler 时，使用 `@swc/core` 的 `jsc.transform.reactCompiler`，在一次 Rust transform 中完成 parse、React Compiler、TypeScript stripping 和 automatic JSX lowering。不要先调用 SWC compiler 再调用 Oxc JSX transform，否则会增加跨语言往返和双重 parse。

#### 5.4.1 Rust React Compiler 调研结论

截至 2026-07-13，SWC 1.15.43 已提供真正的 Rust React Compiler transform：

- Node 构建入口是 `@swc/core` 的 `jsc.transform.reactCompiler`。
- Rust 实现位于 `swc_ecma_react_compiler`，默认 compiler target 为 React 19。
- 输出使用标准 `react/compiler-runtime`，最终 bundle 可观察到 `react.memo_cache_sentinel`。
- 独立的 `@swc/react-compiler` npm 包当前主要暴露 `isReactCompilerRequired` 和 lint/diagnostic API，不是源码 transform 入口。
- Vite/Oxc 的 `transformWithOxc` 只做 TSX/JSX lowering，不具备 React Compiler memo cache 语义，不能称为 React Compiler。

Spike 使用的配置核心为：

```ts
await transform(source, {
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    transform: {
      react: { runtime: 'automatic' },
      reactCompiler: { compilationMode: 'infer' },
    },
  },
})
```

首版建议显式 opt-in。编译器已经通过 unit、production build 和微信 DevTools runtime 验证，但小页面会承担 compiler runtime 固定成本；默认开启应等待完整组件 catalog、长列表和多页面共享 chunk 的 profile。

### 5.5 Entry 和生命周期

每个页面拥有独立 React root：

- `onLoad` 创建 root 并渲染 `<App><Page /></App>`。
- `onReady/onShow/onHide` 分发页面生命周期。
- `onUnload` unmount root、清理 event registry、effect 和 pending payload。
- 页面生命周期 hooks 挂在当前 root context，不能依赖全局单例。

首版 hooks：

- `useLoad`
- `useReady`
- `useShow`
- `useHide`
- `useUnload`
- `usePullDownRefresh`
- `useReachBottom`
- `usePageScroll`
- `useShareAppMessage`
- `useShareTimeline`

App component 会在每个页面 root 外层实例化。跨页面共享状态应通过模块 store/context factory 管理，不能假设一个 React root 跨越小程序页面。

### 5.6 宿主节点协议

推荐首版协议：

```ts
interface SerializedReactHostNode {
  sid: string
  nn: string
  cn?: SerializedReactHostNode[]
  v?: string
  cl?: string
  st?: string
  p?: Record<string, unknown>
}
```

- `sid`：稳定节点 ID，供 key、事件和 wrapper 定位。
- `nn`：host component 名或压缩 alias。
- `cn`：children。
- `v`：text value。
- `cl/st`：高频 class/style 独立字段。
- `p`：需要进入模板的其他序列化属性。

函数、React element、ref 和事件 handler 永远不进入 `setData`。事件闭包变化只更新 runtime props，不发送宿主数据。Spike 已验证，如果不拆分这两种变化，一次计数更新会额外下发父节点 style 对象和 button handler 对应节点。

### 5.7 Commit 与 `setData`

首版规则：

1. 首次 commit 下发完整 `root`。
2. 文本或序列化 prop 更新，下发节点路径。
3. 插入、删除、移动 child 时，下发最近父节点的 `.cn`。
4. 如果父级 `.cn` 已替换，删除其后代的冗余路径。
5. 同一 React commit 最多触发一次页面 `setData`。
6. `setData` callback 完成后再执行需要宿主渲染完成的回调。
7. 页面卸载后丢弃 pending commit。

首版由页面 root 持有唯一的持久化所有权，不同时叠加 Wevu scheduler 或手工输出文件修补。

第二阶段再加入 `custom-wrapper`：

- 基于节点路径找到最近 wrapper。
- 按 wrapper 分组 payload。
- 每个 wrapper 一次 `setData`。
- page 和 wrapper 回调全部完成后结束 commit。

### 5.8 通用模板

微信模板不支持安全的无限自递归。生产实现应采用：

- 构建期生成多层 `react_node_N_*` 模板。
- 默认 `baseLevel` 先采用 Taro 已验证的 16 层。
- 超过层级后进入内部递归组件重新从第 0 层开始。
- WXS 只负责模板名选择、默认值和轻量判断，不执行 React 逻辑。
- 只生成实际使用的 host component 模板。
- 原生 usingComponents 按页面配置加入模板 catalog。

所有 WXML、WXS、内部组件 JS/JSON 必须通过 Rolldown/Vite `emitFile` 产生，不能在 dev/HMR 后手工 `writeFile` 修补输出。

### 5.9 事件

页面模板统一绑定稳定方法，例如 `eh`：

```xml
<button data-sid="{{i.sid}}" bindtap="eh" />
```

runtime：

1. 从 `currentTarget.dataset.sid` 找到 host node。
2. 构造 target 到 root 的 path。
3. 逆序执行 capture handler。
4. 正序执行 bubble handler。
5. 支持 `stopPropagation`。
6. 通过 reconciler priority/batched update 执行 handler。
7. commit 后统一 flush `setData`。

受控 `Input/Textarea/Switch/Checkbox` 需要专门的 value tracker。不能只更新 React props，否则宿主值变化不会自动回到 runtime；也不能每次 input 都强制全节点下发。

### 5.10 原生组件

首版提供：

```ts
const NativeCard = createNativeComponent('native-card')
```

要求页面 JSON 的 `usingComponents` 已声明同名组件。构建端从 JSON 生成 native template，并收集允许的 props/events。

React function component 只存在 JS/Fiber 树中，不生成小程序自定义组件文件。只有显式 native component 才进入 `usingComponents`。

首版不把 `.vue` 文件直接 import 为 React component。需要混用时，先把 Vue/Wevu 组件编译成原生自定义组件，再通过 native bridge 使用。

### 5.11 生产环境与 chunk

React CommonJS entry 依赖 `process.env.NODE_ENV` 选择 production build。React 18 Spike 的第一次构建未显式注入该常量，主包报告为 610 KB；注入 production 并启用 minify 后降到 114 KB。升级 React 19/reconciler 0.33 后，等价 Oxc baseline 为 141 KB。

正式插件必须：

- build 强制将 React/reconciler 解析到 production 分支。
- dev 使用 development 分支和可读错误。
- 不依赖用户手写 `define`。
- 对重复 React 副本和 React/reconciler 版本不匹配给出构建错误。

chunk 策略：

- 普通主包页面共享 `react`、`react-reconciler` 和 `@weapp-vite/react` runtime chunk。
- 普通分包优先复用主包 common chunk。
- 独立分包必须复制 runtime，因为平台不允许依赖主包代码。
- 继续遵循现有 `weapp.chunks` 所有权，不在 React 插件内再实现 chunk splitter。
- analyze 报告应单列 React runtime、host catalog 和通用模板体积。

### 5.12 HMR

首版正确性目标：

- TSX 变化能使对应 page entry 失效并重新发射。
- 通用模板 catalog 变化能使依赖页面 WXML/JSON 更新。
- 共享 React component 变化能传播到所有 importer 页面。
- 首版允许页面级重新挂载，不承诺保留 Hooks state。

第二阶段接入 `react-refresh`：

- runtime 注册 renderer。
- virtual entry 注入 refresh boundary。
- 仅在签名兼容时保留 state。
- export shape 或 host catalog 变化时回退页面重挂载。

不要把 React Refresh 和现有 stateful HMR 混成两个同时修改同一页面状态的 owner。

## 6. Spike 实现与结果

Spike 位于 `e2e-apps/react-runtime-spike`，没有修改正式 `packages/*` 或 `packages-runtime/*`。

验证内容：

- React 19.2.7。
- `react-reconciler` 0.33.0。
- Oxc automatic JSX baseline。
- SWC 1.15.43 Rust React Compiler。
- `View/Text/Button/Input` host components。
- `useState`、`useContext`、`useMemo`。
- text update。
- keyed append 和 prepend。
- runtime event dispatch。
- class/style/props 序列化。
- 页面 root mount/unmount。
- 5 层实验性通用 WXML。

### 6.1 Payload

测量场景包含 12 个序列化节点：

| 指标              |  结果 |
| ----------------- | ----: |
| 首次 root payload | 506 B |
| 单次计数更新      |  66 B |
| keyed list append | 237 B |
| 总 `setData` 次数 |     3 |

更新路径：

```text
root.cn[0].cn[0].cn[0]
root.cn[0].cn[2].cn
```

这证明标量更新和结构更新需要不同的 payload 粒度。

### 6.2 React 19 与 HostConfig 0.33 迁移结果

React 19/reconciler 0.33 不是只改依赖版本。Spike 验证了以下 contract 变化：

- `prepareUpdate/updatePayload` 已从 mutation HostConfig 路径移除，`commitUpdate` 直接接收 `type/previousProps/nextProps`。
- `createContainer` 增加 caught、recoverable 和 transition indicator 回调，共 10 个参数。
- renderer 必须实现 current update priority 的 set/get/resolve，以及 transition context。
- 不支持资源加载或 commit suspension 时，也要提供明确的 no-op/false HostConfig 方法。
- React 19 实现要求非空 host context；共享空对象可满足约束，`null` 会在开发态拒绝渲染。
- 初始 mount/unmount 使用 `updateContainerSync + flushSyncWork`。
- 小程序宿主事件通过 `flushSyncFromReconciler` 建立同步更新边界；直接从 renderer 外部调用捕获的 state setter 不再作为同步行为契约。

迁移后 renderer 的 3 条行为测试全部通过，初始 payload 和两类更新 payload 与 React 18 基线完全一致。

### 6.3 构建体积与 Rust Compiler 对比

React 18 原始 Spike 的生产构建为：

| 产物                   |  原始大小 |     gzip |
| ---------------------- | --------: | -------: |
| `app.js`               |       8 B |     35 B |
| `common.js`            |  11,657 B |  4,179 B |
| `rolldown-runtime.js`  |     715 B |    421 B |
| `pages/index/index.js` |  98,411 B | 30,851 B |
| JS 合计                | 110,791 B | 35,486 B |
| 实验性 `base.wxml`     |   5,998 B |        - |

`wv build` 主包报告为 114 KB。

升级 React 19 后，对同一页面分别执行 Oxc baseline 和 SWC React Compiler 构建：

| 指标                           | Oxc baseline | SWC React Compiler |       差值 |
| ------------------------------ | -----------: | -----------------: | ---------: |
| `wv build` 主包报告            |       141 KB |             142 KB |      +1 KB |
| JS 原始合计                    |    138,183 B |          139,462 B |   +1,279 B |
| JS gzip 合计                   |     43,174 B |           43,740 B |     +566 B |
| weapp-vite warm build 内核耗时 |   129-131 ms |         129-136 ms | 无显著差异 |

Compiler 构建最终页面 bundle 包含 `react.memo_cache_sentinel`；transform unit 同时验证源码被改写为 `react/compiler-runtime` memo cache 调用。Oxc baseline 不包含这两项，因此该对比不是普通 JSX transformer 的名称差异。

小页面里 compiler runtime 固定成本大于可裁剪收益，所以体积略增。交替 warm build 未观察到可归因的构建时间回退，但样本和源码规模都不足以形成性能承诺。这个结果不代表大型页面没有收益；需要继续测量父组件高频更新、稳定 props、长列表和多个页面共享 compiler runtime 后的 transform、render 和 commit 时间。

两组结果都只包含 4 种 host component 和 5 层模板，不能直接外推完整 catalog。正式实现必须做 component usage pruning。

### 6.4 测试结果

- renderer unit：3/3 通过。
- transform unit：2/2 通过。
- app TypeScript：通过。
- config TypeScript：通过。
- Oxc baseline 与 SWC React Compiler `wv build`：均通过，最终 JS 无 JSX 残留。
- WeChat DevTools e2e：1/1 通过。
- DevTools runtime warning/error/exception：0/0/0。

DevTools e2e 验证：

- 初始文本 `count:0 doubled:0`。
- 事件桥触发后为 `count:1 doubled:2`。
- keyed list 从 2 项增加到 3 项。
- `SelectorQuery` 确认 `#count` 有真实布局宽度。

React 18 阶段首次真实运行暴露 production HostConfig 缺少 `insertBefore` / `insertInContainerBefore`。React 19 升级又证明类型声明不足以覆盖全部 runtime extension，且 `null` host context 会被实现拒绝。正式包必须用 HostConfig contract test 覆盖 mutation、priority、transition 和 commit suspension 方法，不能只依赖类型或常见页面行为。

### 6.5 Spike 限制

- 不是正式插件，TSX 通过 app 内虚拟模块实验性接管。
- 只有 4 种 host component。
- 模板深度固定为 5，没有递归组件 fallback。
- 没有页面生命周期 hooks。
- 没有原生自定义组件。
- 没有受控 input 真运行时断言。
- 没有 custom-wrapper、React Refresh、分包和多平台。
- 没有 DOM/BOM 兼容层。

## 7. 实施阶段

### Phase 1：协议与微信基础运行时

- 新建 `@weapp-vite/react`。
- 固定 React 19.2 与 reconciler 0.33 兼容矩阵。
- 完成 host tree、serialization、event registry 和 commit scheduler。
- 新增 framework entry registry，React 显式拥有 `.jsx/.tsx`。
- Oxc automatic JSX transform。
- SWC Rust React Compiler 显式 opt-in，并保留 Oxc baseline。
- 生成微信通用模板和内部递归组件。
- 支持基础 host components、class/style 和 tap/input/change。
- `wv prepare` 生成 React TSX 配置。

验收：函数组件、Hooks、Context、keyed list、事件、卸载和生产分支构建通过 DevTools e2e。

### Phase 2：平台契约完整性

- 页面/App 生命周期 hooks。
- controlled form components。
- native component bridge。
- ref public instance。
- error boundary、Suspense fallback 和 StrictMode 验证。
- `custom-wrapper` 分区更新。
- React Refresh。

验收：生命周期、表单、原生组件、HMR 和 wrapper payload 有 unit + DevTools e2e。

### Phase 3：多平台与性能

- 抽象 template/event/component adapter。
- 支付宝和抖音模板实现。
- component usage pruning。
- 分包与独立分包体积治理。
- analyze React runtime 归因。
- payload/profile 预算和长列表压力测试。

验收：三平台 build，微信真实运行时，其他平台至少真实 IDE smoke test；主包、独立分包和更新 payload 不超过设定预算。

## 8. 测试矩阵

### Unit

- HostConfig 所有 required mutation 方法。
- append、prepend、move、remove、clear、unmount。
- text、class、style、prop 更新。
- handler 更新不触发 `setData`。
- 父 `.cn` 替换折叠后代路径。
- capture/bubble/stopPropagation。
- controlled input value tracker。
- commit batch 和卸载丢弃。

### Type contract

- React 19 function/class component。
- host component props/events。
- lifecycle hooks。
- native component generic props。
- `defineConfig({ weapp: { react: true } })`。
- React/Wevu JSX owner 冲突报错。

### Build integration

- app/page TSX virtual entry。
- production React branch。
- 通用模板通过 emit 输出。
- component catalog pruning。
- 普通分包共享 runtime。
- 独立分包复制 runtime。
- HMR importer propagation。
- SWC compiler 产物包含 `react/compiler-runtime` memo cache，Oxc baseline 不包含。
- 最终 bundle 无 JSX、无 `eval/new Function`。

### DevTools e2e

- Hooks/Context。
- keyed list prepend/append/remove。
- tap/input/change。
- 页面 show/hide/unload。
- native component event。
- wrapper update。
- dev rebuild 和 React Refresh。

## 9. 性能门槛

首版合并前至少满足：

- 简单页面生产主包不高于 Spike 的 150 KB 上限预算。
- 简单页面 React 相关 JS gzip 目标不高于 45 KB；当前 compiler 构建为 43,740 B。
- 单次 React commit 最多一次 page `setData`，wrapper 模式按 wrapper 数量计。
- 标量文本更新不得退化为完整 root payload。
- 事件闭包变化不得产生宿主 payload。
- keyed append/prepend 只替换最近稳定 child array。
- runtime tree 和 event registry 在 `onUnload` 后可释放。

这些是首版 gate，不是长期承诺；真实组件 catalog 完成后应重新 profile 并在 analyze history 中保存基线。

## 10. 发布与兼容策略

本次设计报告和隔离 Spike不改变发布包行为，因此不添加 changeset，也不联动 `create-weapp-vite`。

正式实现时需要：

- `@weapp-vite/react` minor changeset。
- `weapp-vite` minor changeset。
- `create-weapp-vite` bump changeset，因为脚手架需要新增 React 模板和依赖选择。
- 中文 changeset summary。
- React 19.2 固定 peer range，并将 reconciler 0.33 HostConfig contract regression 作为发布 gate。

文档、website、skills 和 `dist/docs` 在正式功能可用后同步；设计阶段不把尚未交付的配置写入用户指南。

## 11. 最终决策

1. 采用独立的 React custom renderer，不直接嵌入 Taro。
2. React 正确性以 runtime tree 为基础，静态 AST 只做优化和诊断。
3. 通过显式 `weapp.react` 决定 `.jsx/.tsx` owner，不做 import 猜测。
4. 首版公开 `View/Text/...` 组件，不公开 DOM intrinsic 兼容承诺。
5. 初次 full root，后续 path-level `setData`，结构变化替换最近 `.cn`。
6. 微信使用多层通用模板和内部递归组件。
7. 构建产物只由 Vite/Rolldown emit/write。
8. 首版微信 + React 19.2；SWC Rust React Compiler 先 opt-in，多平台后续单独验收。
