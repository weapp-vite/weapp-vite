# wevu 分包落包 E2E App 设计

Date: 2026-03-12

## 背景

当前仓库已经有两类相关覆盖：

- `e2e-apps/wevu-features`：覆盖 `wevu` + Vue SFC 功能与运行时行为。
- `e2e-apps/subpackage-shared-strategy-complex-*`：覆盖源码层共享 chunk 在分包下的构建与运行时行为。

但还缺一类专门夹具：验证一个真实通过 `pnpm add -D wevu` 安装、并在 Vue SFC 中直接 `import { ref } from 'wevu'` 的 app，在不使用 `weapp.npm.deps` 人工声明归属的前提下，`wevu` 是否可以不进主包，而是落到普通分包与独立分包。

这里的关键不是再测一次“源码共享策略”，而是测“workspace/node_modules 依赖在小程序分包语义下的真实产物归属”。

## 目标

- 新增一个专用 `e2e-apps` 夹具，覆盖 `wevu` 作为 app 级依赖时的分包归属。
- 同时覆盖两层验证：
  - 构建产物层：`wevu` 相关运行时代码不应被主包页面强制拉入；普通分包和独立分包都有可定位的 `wevu` 代码落点。
  - DevTools 运行态层：从普通分包页面和独立分包页面直接打开，Vue SFC + `wevu` 能正常渲染、响应式更新、路由跳转。
- 明确禁止通过 `weapp.npm.deps` 或类似“手工指定 npm 包归属”的配置达成结果。
- 保持夹具最小化，避免引入与问题无关的 UI 组件库或复杂自动导入能力。

## 非目标

- 不覆盖 `wevu/router`、`wevu/store`、`wevu/fetch` 等所有子路径 API。
- 不在这个夹具里验证多平台（alipay/tt）行为，第一阶段只覆盖 `weapp`。
- 不把它做成新的分包策略矩阵；目标是验证真实依赖落包，不是穷举所有 chunk 组合。

## 方案对比

### 方案 A：单 app，同时包含普通分包和独立分包

推荐。

- 主包只保留一个原生或极简非 `wevu` 首页，用于证明“默认没有把 `wevu` 拉进主包”。
- `wevu` 只在两个分包页面内被 SFC 直接引用：
  - 普通分包 `subpackages/normal-wevu`
  - 独立分包 `subpackages/independent-wevu`
- 优点：
  - 单个 fixture 就能看清三者关系：主包、普通分包、独立分包。
  - 运行态测试可以复用一次 build + 一次 automator launch，多次 `reLaunch`。
  - 更容易在一个 `app.json` 下直接比对产物归属差异。
- 缺点：
  - 构建断言需要写得更严谨，避免把“共享 chunk 被正常抽离”误判为“仍落主包”。

### 方案 B：拆成两个 app，分别测普通分包和独立分包

- 一个 app 专测普通分包，一个 app 专测独立分包。
- 优点：
  - 每个 app 的断言更直接，失败定位更单纯。
- 缺点：
  - 用例重复，维护成本更高。
  - 很难在同一套输入下对比普通分包和独立分包的差异。
  - 会额外增加 DevTools e2e 的项目切换时间。

结论：采用方案 A。

## 推荐夹具结构

新增 `e2e-apps/wevu-subpackage-placement`：

```txt
e2e-apps/wevu-subpackage-placement/
  package.json
  project.config.json
  project.private.config.json
  weapp-vite.config.ts
  src/
    app.json
    app.ts
    pages/
      index/
        index.ts
        index.wxml
        index.wxss
        index.json
    subpackages/
      normal-wevu/
        pages/
          entry/
            index.vue
          detail/
            index.vue
        shared/
          normalState.ts
      independent-wevu/
        pages/
          entry/
            index.vue
          detail/
            index.vue
        shared/
          independentState.ts
```

依赖要求：

- `package.json` 中直接声明：
  - `devDependencies.wevu = "workspace:*"` 或与用户真实安装习惯一致的 `wevu`
  - `devDependencies.weapp-vite = "workspace:*"`
- 不配置 `weapp.npm.deps`
- 不设置 `weapp.npm.enable = false`

这样夹具才能代表“真实通过 pnpm 安装的 `wevu` 依赖”，而不是人为绕过 npm/workspace 依赖路径。

## 页面设计

### 主包首页 `pages/index/index`

主包首页必须避免直接或间接引用 `wevu`。推荐使用原生 `Page()`：

- 页面文案明确标识：`__WSP_MAIN_NATIVE__`
- 提供两个按钮或链接文案，分别跳到：
  - `/subpackages/normal-wevu/pages/entry/index`
  - `/subpackages/independent-wevu/pages/entry/index`
- 仅承担导航和主包基准页职责，不放任何 Vue SFC 组件。

这样构建断言时可以明确检查：

- 主包首页 JS/WXML 存在；
- 主包首页 JS 不包含 `wevu` 标记；
- 主包首页自身不触发 `wevu` 依赖注入。

### 普通分包页面

普通分包提供两个 SFC 页面：

- `entry/index.vue`
  - 直接 `import { computed, ref } from 'wevu'`
  - 展示稳定标记：`__WSP_NORMAL_ENTRY__`
  - 展示响应式状态：count、double、package type
  - 提供按钮：
    - `+1`
    - 跳到本分包 detail
    - 跳到独立分包 entry
- `detail/index.vue`
  - 复用 `shared/normalState.ts`
  - 展示稳定标记：`__WSP_NORMAL_DETAIL__`
  - 验证同一普通分包内共享状态仍可读

普通分包不需要复杂特性，只需要证明：

- `wevu` 在普通分包页面内正常初始化；
- 同一普通分包内二次页面跳转不出错；
- 普通分包到独立分包的跨包跳转不出错。

### 独立分包页面

结构与普通分包对称，但状态文件独立：

- `entry/index.vue`
  - 标记：`__WSP_INDEPENDENT_ENTRY__`
  - 直接使用 `wevu`
  - 提供 `+1`、跳 detail、跳普通分包 entry
- `detail/index.vue`
  - 标记：`__WSP_INDEPENDENT_DETAIL__`
  - 复用 `shared/independentState.ts`

这里的重点不是共享状态与普通分包互通，而是验证：

- 独立分包能自举自己的 `wevu` 运行时；
- 独立分包内部二级页面仍可继续工作；
- 从独立分包跳回普通分包时不会因为运行时归属错误而白屏或报错。

## app.json 设计

推荐直接手写 `src/app.json`，避免自动路由引入额外变量：

- `pages` 只保留主包首页。
- `subPackages` 明确声明两个分包：
  - `subpackages/normal-wevu`
  - `subpackages/independent-wevu`，并设置 `independent: true`

示意：

```json
{
  "pages": ["pages/index/index"],
  "subPackages": [
    {
      "root": "subpackages/normal-wevu",
      "pages": ["pages/entry/index", "pages/detail/index"]
    },
    {
      "root": "subpackages/independent-wevu",
      "pages": ["pages/entry/index", "pages/detail/index"],
      "independent": true
    }
  ]
}
```

这样断言点最稳定，也便于 DevTools e2e 直接 `reLaunch` 到目标路由。

## weapp-vite.config.ts 设计

配置保持最小化：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
  },
  build: {
    minify: false,
  },
})
```

约束如下：

- 不加 `weapp.npm.deps`
- 不关 `npm.enable`
- 不引入 `chunks.sharedOverrides`
- 不把测试变成“靠配置指定目标结果”

如果后续发现需要锁定 chunk 行为，优先新增单测或更精确的产物断言，而不是先给 fixture 加特殊配置。

## 构建产物断言设计

新增 `e2e/ci/wevu-subpackage-placement.build.test.ts`，目标是确认“主包不误带 `wevu`，分包里能找到 `wevu` 相关实现落点”。

建议断言分三层：

### 1. 路由与页面文件存在

- `dist/app.json` 存在且包含两个分包定义。
- 主包、普通分包、独立分包的 4 个目标页面输出都存在。

### 2. 主包隔离断言

- 主包首页 `pages/index/index.js` 包含 `__WSP_MAIN_NATIVE__`
- 主包首页 `pages/index/index.js` 不包含明显 `wevu` 运行时标记，如：
  - `createSSRApp` 这类 Vue Web 标记不 relevant，不应作为条件
  - 应选仓库内稳定字符串，比如 `__wevu`、`onLoadHooks`、`createReactiveObject` 之类需要在调研后选择
- 主包目录下不存在只应由 `wevu` 页面触发的生成页面/组件产物

### 3. 分包落点断言

- 普通分包 entry/detail 的 JS 中存在 `wevu` 使用代码和稳定文案标记。
- 独立分包 entry/detail 的 JS 中存在 `wevu` 使用代码和稳定文案标记。
- 在产物树中定位 `wevu` 相关共享实现的真实文件位置，并断言：
  - 不是只落在主包独有位置；
  - 对独立分包来说，必须存在该分包自身可访问的副本或等价共享落点；
  - 普通分包允许引用共享 chunk，但该共享 chunk 不能要求先进入主包 `wevu` 页才可用。

这里不建议一开始对具体 chunk 文件名写死，因为命名策略可能变化。更稳妥的方式是：

- 枚举 `dist/**/*.js`
- 搜索稳定的 `wevu` runtime 片段和页面标记
- 验证命中路径分布是否符合“主包无 wevu 页面依赖、普通分包有可达实现、独立分包有自足实现”

## DevTools 运行态断言设计

新增 `e2e/ide/wevu-subpackage-placement.runtime.test.ts`，复用现有模式：

- build 一次
- launch automator 一次
- 对多个 route 做 `miniProgram.reLaunch()`

建议覆盖路由：

1. `/pages/index/index`
2. `/subpackages/normal-wevu/pages/entry/index`
3. `/subpackages/normal-wevu/pages/detail/index`
4. `/subpackages/independent-wevu/pages/entry/index`
5. `/subpackages/independent-wevu/pages/detail/index`

运行态断言分两层：

### 1. 静态渲染确认

- 主包首页包含 `__WSP_MAIN_NATIVE__`
- 普通分包页面包含 `__WSP_NORMAL_ENTRY__` / `__WSP_NORMAL_DETAIL__`
- 独立分包页面包含 `__WSP_INDEPENDENT_ENTRY__` / `__WSP_INDEPENDENT_DETAIL__`

### 2. 最小交互确认

- 在普通分包 `entry` 点击 `+1`，验证 count/double 更新。
- 从普通分包 `entry` 导航到 `detail`，验证共享状态可读。
- 在独立分包 `entry` 点击 `+1`，验证 count/double 更新。
- 从独立分包 `entry` 导航到 `detail`，验证共享状态可读。
- 从普通分包跳独立分包、从独立分包跳普通分包，验证页面成功切换且标记正确。

不需要在这个用例里做复杂 DOM 操作，只要证明页面可进、响应式可跑、跨包可跳即可。

## 命名与标记策略

为了让构建断言和运行态断言都稳定，页面里应埋入固定字符串：

- `__WSP_MAIN_NATIVE__`
- `__WSP_NORMAL_ENTRY__`
- `__WSP_NORMAL_DETAIL__`
- `__WSP_INDEPENDENT_ENTRY__`
- `__WSP_INDEPENDENT_DETAIL__`

同时在按钮和状态节点上加固定 `id`：

- `normal-inc`
- `normal-to-detail`
- `normal-count`
- `normal-double`
- `independent-inc`
- `independent-to-detail`
- `independent-count`
- `independent-double`

这样 DevTools e2e 可以直接按现有 `wevu-features` 的点击与 WXML 读取方式复用。

## 风险与缓解

### 风险 1：构建断言误把共享 chunk 当作“进主包”

缓解：

- 不按 chunk 文件名判断。
- 结合页面入口 JS、`app.json`、目标标记字符串和命中路径分布一起判断。

### 风险 2：普通分包允许共享主包公共 chunk，导致结论不清

缓解：

- 主包不写任何 `wevu` 页面，只保留原生页。
- 只要主包入口页不含 `wevu` 注入，且普通分包直接 `reLaunch` 正常，就能排除“必须先进入主包 wevu 页”这一错误前提。

### 风险 3：独立分包判定过于依赖输出细节

缓解：

- 对独立分包优先看运行态结果。
- 构建态只要求“存在独立分包自身可访问的 `wevu` 实现落点”，不对 chunk 名强绑定。

## 实施顺序

1. 新增 `e2e-apps/wevu-subpackage-placement` 夹具。
2. 先补 `e2e/ci/wevu-subpackage-placement.build.test.ts`，跑通产物断言。
3. 再补 `e2e/ide/wevu-subpackage-placement.runtime.test.ts`，跑通 `reLaunch` + 交互断言。
4. 如果产物分布和预期不一致，再回头决定是否需要补更底层单测，而不是先给 fixture 增加特殊配置。

## 验收标准

- `wevu` 通过 app 真实依赖安装，不使用 `weapp.npm.deps`。
- 主包首页不直接使用 `wevu`，且构建产物不显示被错误注入。
- 普通分包页面可直接打开并运行 `wevu` SFC。
- 独立分包页面可直接打开并运行 `wevu` SFC。
- 普通分包与独立分包内部二级页面可继续工作。
- `e2e/ci` 与 `e2e/ide` 各有一条独立测试，失败时能直接看出是“落包错误”还是“运行时错误”。
