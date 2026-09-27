# Wevu × json-render 原型

使用 `@json-render/core@0.21.0` 驱动 Wevu 微信小程序中的售后表单。所有组件预先编译为小程序组件；运行时只解释 JSON 数据，不生成或执行代码，不依赖 React、Vue Web renderer 或模型服务。

## 运行

在仓库根目录执行：

```sh
pnpm install
pnpm --filter wevu-json-render-demo prepare:weapp
pnpm --filter wevu-json-render-demo dev
pnpm --filter wevu-json-render-demo open
```

微信开发者工具需要启用服务端口。应用沿用仓库演示项目的真实 AppID；部署到自己的账号时替换项目配置。

## 演示流程

1. 填写售后原因，条件提示消失；提交时按钮禁用，模拟服务在 600 ms 后返回。
2. 原因包含“失败”时模拟失败，修改后可重试。实际提交不请求任何业务服务。
3. 点击“播放增量更新”，录制的 JSONL 分块到达，新增服务说明、更新标题、删除提示节点，已输入内容保留。
4. 点击“验证异常恢复”，尝试把组件类型改为未知值，显示错误并保留上一版有效界面。
5. “加载完整 JSON”和“重置”重新加载初始结构、清空业务状态，并取消待处理任务。

## 协议边界

`src/fixtures/afterSales.ts` 保存完整描述和录制的 SpecStream。原型使用上游 `root/elements/children` 格式，例如：

```json
{
  "root": "card",
  "elements": {
    "card": {
      "type": "Card",
      "props": { "title": "售后进度" },
      "children": ["status"]
    },
    "status": {
      "type": "Text",
      "props": { "text": { "$state": "/status" } },
      "children": []
    }
  }
}
```

| 能力 | 本原型支持范围 |
| --- | --- |
| 组件 | `Stack`、`Card`、`Text`、`Input`、`Button`、`OrderSummary` |
| children | 仅容器 `Stack`、`Card`；节点 ID 唯一引用，最多 200 个节点、8 层 |
| `$state` | 字符串属性读取 `/form/reason`、`/status`、`/error`；布尔属性读取 `/busy`、`/submitted` |
| `$bindState` | `Input.value` 绑定 `/form/reason` |
| visible | 布尔值，或 `$state` 配合可选的 `eq`、`not: true` |
| on | `Button.on.press` 映射到本地 `submit` 动作 |
| SpecStream | `add`、`replace`、`remove`，只允许更新 `/root`、`/elements` |

其他表达式、repeat、slots、watch、任意样式、动作参数和动态组件类型均不支持，校验时明确拒绝。业务初始状态由应用单独创建，本版本不接受 spec 的 `state` 字段或服务端状态 Patch。

## 实现分层

- `src/runtime/schema.ts`：严格子集校验、引用和深度检查。流式暂缺引用时等待，结束时仍缺失则报错。
- `src/runtime/core.ts`：统一 Core 入口。先执行 `compat.ts` 的 Zod `jitless` 配置；本次解析版本为 Zod 4.6.5。
- `src/runtime/stream.ts`：按批事务化应用 Core Patch；候选描述与可见描述隔离，非法更新停止当前流。逐行新建编译器，避免上游按文本去重吞掉合法的重复数组操作。
- `src/runtime/session.ts`：唯一的响应式业务状态、输入回写、动作去重、播放和卸载清理。
- `src/runtime/projection.ts`：复用 Core 的属性、绑定和可见性解析，投影成可序列化的 Wevu 节点树。
- `src/components/spec-node`：显式自注册的递归 SFC，通过静态分支分发组件。自定义事件接收 Wevu 解包后的载荷；原生 input 接收宿主事件。
- `src/runtime/metrics.ts`：仅用于原型验收，统计页面和组件的 `setData` 调用及 JSON UTF-8 字节数，不参与渲染逻辑。

这是应用内适配实验，尚未形成通用 renderer API。Vue SFC 在这里是编译输入，不意味着支持 Vue Web 的 VNode、`h()` 或 `<component :is>`。

## 验证

```sh
pnpm --filter wevu-json-render-demo test
pnpm --filter wevu-json-render-demo typecheck
pnpm exec eslint apps/wevu-json-render-demo
pnpm exec stylelint 'apps/wevu-json-render-demo/src/**/*.vue'
pnpm --filter wevu-json-render-demo build
node --import tsx scripts/check-e2e-ide-shared-launch.ts
```

以下 E2E 必须串行运行，开始前确认没有残留的 E2E、automator 或 dev-watch 进程：

```sh
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/wevu-json-render.runtime.test.ts
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/wevu-json-render.runtime.test.ts
```

suite 只启动一次 automator，通过 `reLaunch` 切换场景。可见文本、输入值、业务状态、失败重试和卸载清理分别断言。测试从页面 `readMetrics` 方法读取观测值；真实 IDE 首屏截图输出到 `docs/reports/json-render/after-sales.png`，生成证据不进入提交。

2026-09-28 本地验证结果：

- 应用单测 12 项通过，包含构建后的隔离执行检查：显式拦截 `Function`/`eval`，断言初始化、校验、解析和 Patch 全程没有动态求值尝试。
- headless 与真实微信 DevTools 各 3 个场景通过，运行时无 warning/error/exception。
- simulator 的递归属性、事件、属性观察器相关单测 16 项通过；新增浏览器回归 1 项通过；包级 typecheck 和 test:types 通过。
- E2E suite manifest 27 项通过，共享 automator 启动检查通过。

| 固定场景基线 | headless | DevTools |
| --- | --- | --- |
| 应用 dist 总字节数 | 389782 | 389782 |
| 首次渲染、输入、完整流式播放的 setData 次数 | 26 | 24–25 |
| 对应累计 JSON UTF-8 字节数 | 13283 | 13126–13127 |
| 卸载后 setData / 遗留任务 | 0 / 0 | 0 / 0 |

这些数值是当前依赖和固定场景的观测值，不是跨版本性能保证；调度批次可以不同，验收要求两端的可见状态和事件结果一致。未验证真机、其他小程序平台、网络分块传输或真实 AI 输出。

## 验证中修复的 simulator 边界

真实 DevTools 能更新递归子组件，而 simulator 曾保留初始文案。最小复现证明父子组件共享对象属性引用，父级深层 patch 提前改变子级持有的旧对象，使依赖引用变化的投影失效。

本次在 Node 和 browser 的属性传递边界隔离对象引用，补充 `recursiveProps` 单测、浏览器回归及 simulator patch changeset。未改 Wevu 编译或运行时，也不需要联动 `create-weapp-vite` 发版。两个既有 render/component 文件超过 300 行；本次保持其原有平台分层，仅修正属性所有权，不将无关拆分混入原型。
