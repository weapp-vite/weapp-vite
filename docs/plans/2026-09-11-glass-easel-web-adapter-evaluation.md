# glass-easel 作为 Web 兼容适配器的架构选型评估

日期：2026-09-11

## 决策摘要

glass-easel 是微信小程序组件框架的重写实现，负责组件树、模板、属性、事件、生命周期和更新调度。它不是完整的小程序 SDK，也不包含 `view`、`image` 等宿主组件实现，不能单独提供路由、网络、存储或设备能力。

本仓库已经有独立的 Web runtime：通过 WXML 编译、Web Components、Shadow DOM 和 Lit 提供浏览器渲染，并由 `@weapp-vite/web` 负责页面栈、路由、生命周期、原生组件映射、WXSS、rpx 和宿主注入。

**推荐结论：**

- 不直接用 glass-easel core 替换当前 Web renderer。
- 不把 glass-easel 的 Web adapter 当作完整的小程序 Web SDK。
- 将 glass-easel 定位为可选的组件语义后端或实验性 renderer。
- 短期继续以现有 Web runtime 为默认实现，借鉴 glass-easel 的组件模型和兼容测试。
- 只有在小范围 PoC、兼容矩阵和真实性能数据稳定后，才考虑扩大集成。

微信端的 glass-easel 配置仍沿用现有宿主 JSON 方案，见 [glass-easel 兼容与迁移检查](../glass-easel.md)。

## glass-easel 能力分析

官方仓库将 glass-easel 划分为多个职责：

- `glass-easel`：组件框架核心，提供组件树、模板执行、属性、事件、生命周期和更新算法。
- `glass-easel-miniprogram-adapter`：将核心接口适配为小程序自定义组件接口。
- `glass-easel-miniprogram-webpack-plugin`：配合 adapter 处理 WXML、WXSS 和 JS 文件。
- `glass-easel-template-compiler`：将 WXML 编译为 JavaScript，使用 Rust 实现。
- `glass-easel-stylesheet-compiler`：将 WXSS 编译为 CSS，使用 Rust 实现。

其 backend 抽象允许组件框架运行在不同环境，但 Web adapter 只解决组件框架和小程序接口模拟，不会自动提供微信宿主组件或完整 API。

官方文档还明确了几个边界：

- glass-easel 与旧组件框架约有 99% 接口兼容，但属于完全重写，仍可能存在行为差异。
- 自定义 backend、外部组件和自定义模板引擎等高级能力受小程序安全边界限制。
- 小程序代码目前不能自行加载任意 glass-easel 子模块；微信基础库负责提供正式运行时。

## 当前 weapp-vite Web runtime

当前 Web runtime 已经形成自己的宿主边界：

- 构建期扫描并编译 WXML/WXSS。
- 使用 Web Components 和 Shadow DOM 隔离组件。
- 使用 Lit 进行响应式 DOM 更新。
- 将 `Page`、`Component` 和常用原生组件映射到浏览器元素。
- 保留 `setData`、`triggerEvent`、小程序生命周期和页面栈语义。
- 提供 `navigateTo`、`redirectTo`、`reLaunch`、`switchTab` 等路由桥接。
- 支持设备视口、rpx、WXSS 选择器转换和可注入宿主能力。

`wevu` 负责响应式状态、组件生命周期注册和 `setData` 提交模型；`@weapp-vite/web` 负责浏览器宿主、渲染组件、路由和 API 桥。两者都不是 glass-easel 的职责替代品。

相关设计：[Web runtime rendering design](./2026-01-19-web-runtime-rendering-design.md)；运行时说明：[`@weapp-vite/web`](../../packages-runtime/web/README.md)。

## 方案对比

| 方案                                                      | 评估                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 直接把 glass-easel core 替换现有 Web renderer             | 不推荐。宿主原生组件、路由、API 和现有 Web runtime 契约仍需自行实现，替换后会形成双重适配边界。 |
| 使用 glass-easel adapter/compiler 重做 Web runtime        | 可行但成本高。需要重新接入编译器、组件注册、样式、宿主元素和调试工具。                          |
| glass-easel 作为可选组件后端或实验 renderer               | 推荐。可以隔离风险，逐项比较组件语义和更新行为。                                                |
| 保持当前 Web runtime，借鉴 glass-easel 组件语义和测试模型 | 短期推荐。收益明确，迁移成本最低，不改变现有用户默认行为。                                      |

## 关键兼容差异

### 编译产物

glass-easel template compiler 输出面向自身运行时的模板代码；当前 weapp-vite Web runtime 输出 Lit render function。两者的模板注册、表达式上下文、节点身份和更新边界不同，不能只替换一个编译器包。

### 组件注册和生命周期

glass-easel 的组件实例、backend 节点和生命周期由其组件树管理；当前 Web runtime 由 Web Components 生命周期、Wevu 注册逻辑和页面宿主共同管理。直接叠加可能导致挂载、卸载和更新回调重复。

### props、observer 和 slot

glass-easel 对属性类型转换、默认值、observer、slot 和组件泛型有自己的实现；Wevu 已针对小程序宿主和 Web adapter 建立对应契约。集成必须用行为测试比较，不应只比较类型声明。

### 原生组件

glass-easel 不包含小程序原生组件实现。Web 侧仍需要 `view`、`input`、`scroll-view`、`swiper`、`canvas` 等浏览器适配组件，因此不能由 glass-easel 单独完成 Web 兼容。

### Shadow DOM 和 backend

当前 runtime 的 Shadow DOM 是浏览器隔离策略；glass-easel backend 是组件框架的环境抽象。二者可以在实验 adapter 中组合，但需要明确节点所有权、事件冒泡和样式注入的唯一来源。

### 路由和 API

页面路由、App 生命周期、网络、存储、剪贴板、媒体和设备能力不属于 glass-easel core，应继续由 weapp-vite Web host 和 API 适配层负责。

## 推荐架构

采用三层边界：

1. **weapp-vite 编译层**

   继续负责项目扫描、入口分析、WXML/WXSS 处理、平台输出和宿主配置。

2. **可选组件渲染后端**

   新增实验性 glass-easel adapter，只承接组件树、模板执行、props、事件、slot 和生命周期。第一阶段限制组件集合，不改变默认 renderer。

3. **weapp-vite Web host**

   继续负责原生组件映射、路由、App/Page 生命周期、API、设备视口、样式宿主和浏览器能力注入。

glass-easel 不接管完整 Web runtime，也不改变微信端现有的 `componentFramework` / `glassEaselWebview` 配置逻辑。

## 分阶段路线

### 阶段 0：能力探针

验证 core、Web adapter、template compiler 的安装、构建和最小组件挂载，并记录：

- 生命周期顺序。
- props 类型转换和默认值。
- 事件传播。
- slot 和组件泛型。
- `setData` 后的节点更新。
- 列表更新和节点复用。

### 阶段 1：受限 PoC

只支持 `view`、`text`、自定义组件、插值、条件、循环和事件；由现有 Web host 提供原生组件和路由。

### 阶段 2：兼容矩阵

针对模板、样式、生命周期、路由和宿主 API 与现有 Web runtime 做 parity 测试。断言使用稳定场景 ID、结构化快照和事件序列，不依赖压缩变量名或 chunk 名。

### 阶段 3：可选后端

增加明确的实验配置选择 glass-easel renderer；默认仍使用当前 Web runtime。实验 renderer 失败时应报告错误并停止启动，避免静默产生不一致页面。

### 阶段 4：选型复审

以兼容性、首屏挂载、批量更新、列表更新、内存释放和维护成本数据为依据，决定是否扩大覆盖或继续保持实验状态。

## 测试和验收标准

- 单元测试：模板、props、事件、生命周期、slot、列表更新和组件卸载。
- 浏览器 E2E：真实页面交互、路由切换、组件状态恢复和宿主 API。
- parity 测试：同一场景分别运行现有 Web renderer 与 glass-easel adapter。
- 构建检查：确认模板、样式、页面入口和组件产物存在。
- 性能基线：首屏挂载时间、批量 `setData`、列表更新耗时和卸载后的内存/监听器清理。
- 微信端继续使用 `wv analyze --glass-easel-check)，并在基础库 3.8.12+ 的 DevTools/真机环境验证 `glassEaselWebview`。

## 风险、成本和退出条件

- 如果 Web adapter 无法稳定映射原生组件，停止替换 renderer。
- 如果双重组件树导致生命周期或更新重复，glass-easel 只保留为独立实验后端。
- 如果 compiler 能力重复且维护成本高于收益，继续使用现有 weapp-vite 编译链。
- 所有实验能力必须显式开启，不得影响当前 Web runtime 默认行为。
- Web runtime、glass-easel Web adapter 和微信真机必须分别记录结果，不能用其中一种环境的通过结论替代另外两种。

## 最终推荐

当前最合理的选型是：**保留现有 Web runtime 作为默认实现，把 glass-easel 引入为可选的组件语义后端实验**。

这样可以获得 glass-easel 在组件模型、模板语义和兼容测试方面的价值，同时避免重复实现原生组件、路由、API 和浏览器宿主。完成阶段 0～2 的真实数据后，再决定是否进入可选后端阶段。
