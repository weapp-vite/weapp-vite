# Web Runtime 组件标签映射设计

## 目标

让 `apps/weapp-vite-web-demo` 在 Web 端实现“可交互 + 渲染稳定”的最小闭环：

- 组件能正确渲染为自定义元素，事件绑定可用。
- 样式与 rpx 转换保持现有策略，避免强制改动 demo。

## 范围

- 在 `packages/web` 内补齐编译期的自定义组件标签映射。
- 必要时（且说明原因）才对 `apps/weapp-vite-web-demo` 做最小化修补。

## 非目标

- 完整覆盖所有小程序 API（只做到交互所需的最小集合）。
- 引入复杂的运行时 DOM 替换或大型渲染框架。

## 方案概览（推荐）

**编译期映射 + runtime tag 复用**：

- 扫描 `usingComponents` 时，记录 key -> 组件脚本路径，计算出与 runtime 一致的 `wv-component-*` 标签。
- 在 WXML 编译阶段注入该映射，生成的模板中直接使用 web tag，避免运行时替换成本。
- 若映射缺失则回退 `normalizeTagName`，保持最小可用性。

该方案将“组件解析”前置到构建期，行为稳定且与现有 runtime 的 customElements 注册逻辑一致。

## 数据流与核心改动

1. `plugin.ts` 扫描阶段：

- 从 `app.json`、`page.json`、`component.json` 中读取 `usingComponents`。
- 解析 key（大小写统一），用 `resolveComponentBase + resolveScriptFile` 找到脚本路径。
- 将脚本路径映射到 `componentIdPosix`，再通过与 runtime 同步的 `slugify(id, 'wv-component')` 得到 web tag。
- 按 `templatePath` 维度缓存 `componentTags`（局部覆盖全局）。

2. `compileWxml`：

- 增加可选 `componentTags` 参数。
- 在 `renderElement` 里优先使用映射标签：`componentTags[name] ?? componentTags[name.toLowerCase()]`。
- 命中则直接输出该 tag，否则回退 `normalizeTagName`。

3. 样式兼容策略：

- 默认先观察能否满足 demo；若仍有明显“button 样式缺失”，考虑在 `transformWxssToCss` 做轻量 selector rewrite（例如 `button` -> `weapp-button`），只作用在选择器边界。
- 若 rewrite 风险过大，再对 demo 做最小化样式修补，并说明原因。

## 错误处理

- 解析 `usingComponents` 失败时记录 warning（含 json 路径、组件 key），不中断构建。
- 模板编译无法映射时回退标签，保证页面仍能渲染。

## 测试计划

新增/补充 `packages/web/test`：

- `compileWxml` 传入 `componentTags` 时，断言标签被正确改写。
- 验证页面级 usingComponents 覆盖 app 级映射。
- 若启用 selector rewrite，添加针对选择器边界的测试，避免误改类名/属性。

## 可能的 demo 修补（仅在必要时）

- 若 `weapp-button` 影响了 `button` 选择器命中导致样式缺失，可将 `apps/weapp-vite-web-demo/src/pages/index/index.scss` 的 `.nav-actions button` 改为 `.nav-actions weapp-button`。
- 该改动仅作为兼容补丁，优先尝试编译期/运行时解决。
