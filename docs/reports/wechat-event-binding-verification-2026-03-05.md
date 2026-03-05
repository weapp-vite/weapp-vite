# 微信小程序事件绑定与 `triggerEvent` 命名规则验证报告

- 日期：2026-03-05
- 仓库：`weapp-vite`
- 验证类型：WeChat DevTools Runtime E2E（真实触发）

## 1. 背景

本报告用于沉淀以下问题的可复用结论：

1. `bindtap` 与 `bind:tap` 是否都可触发。
2. 同一节点同时声明 `bindxxx` 与 `bind:xxx` 时是否都会触发。
3. `triggerEvent` 事件名包含中划线（`-`）和下划线（`_`）时，绑定规则是否一致。
4. 原生 `view`、原生自定义组件、wevu SFC 组件三类场景是否有差异。

## 2. 官方文档基线

参考微信官方事件文档：
https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html

文档语义（摘要）：

1. 基础库 `1.5.0` 起，在大多数组件和自定义组件中支持 `bind:xxx` 写法。
2. 基础库 `2.8.1` 起，在所有组件中支持该写法。

这表示在兼容版本足够新时，`bindxxx` 与 `bind:xxx` 在语义层面是等价别名；但“同节点双写”的执行细节并未承诺“两个都会触发”。

## 3. 验证方法

本次结论基于运行时触发，不是仅看编译产物。

验证入口：

1. `e2e/ide/lifecycle-compare.test.ts`
2. `e2e-apps/lifecycle-compare/src/pages/components/index.wxml`
3. `e2e-apps/lifecycle-compare/src/pages/components/index.ts`
4. `e2e-apps/lifecycle-compare/src/components/event-probe-native/index.ts`
5. `e2e-apps/lifecycle-compare/src/components/event-probe-wevu-vue/index.vue`

执行命令（针对验证用例）：

```bash
pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts e2e/ide/lifecycle-compare.test.ts -t "verifies"
```

## 4. 结论总览

### 4.1 `tap` 与普通自定义事件（`probe`）

在三类对象中结论一致：

1. 原生 `view`
2. 原生自定义组件
3. wevu SFC 组件（向父层派发自定义事件）

| 场景            | 单写 `bindxxx` | 单写 `bind:xxx` | 同节点双写                     |
| --------------- | -------------: | --------------: | ------------------------------ |
| `tap` / `probe` |           触发 |            触发 | 仅触发一个处理函数，不会双触发 |

本次实测中，同节点双写时触发的是无冒号写法对应的处理函数（`bindxxx`），冒号写法不触发。

### 4.2 `triggerEvent` 事件名为中划线与下划线

验证事件名：

1. 中划线：`probe-hyphen`
2. 下划线：`probe_under`

在原生组件与 wevu SFC 组件中结论一致：

| 事件名         | 写法                | 结果                        |
| -------------- | ------------------- | --------------------------- |
| `probe-hyphen` | `bindprobe-hyphen`  | 不触发                      |
| `probe-hyphen` | `bind:probe-hyphen` | 触发                        |
| `probe-hyphen` | 两者同节点双写      | 仅 `bind:probe-hyphen` 触发 |
| `probe_under`  | `bindprobe_under`   | 触发                        |
| `probe_under`  | `bind:probe_under`  | 触发                        |
| `probe_under`  | 两者同节点双写      | 仅 `bindprobe_under` 触发   |

## 5. wevu SFC 与原生差异说明

运行时事件分发语义上，本次验证未发现 wevu SFC 与原生组件差异。

但模板书写层面需要区分：

1. 在 `.wxml` 中使用 `bindxxx` / `bind:xxx`。
2. 在 wevu `.vue` 模板中，应使用 `@event`（或 `v-on:event`）表达事件绑定。
3. `.vue` 模板里的 `bind:xxx` 会被 Vue 语法当作属性绑定语法处理，不是事件绑定写法。

## 6. 推荐规范

建议在团队内统一以下规则：

1. 不要在同一个节点同时声明 `bindxxx` 与 `bind:xxx`。
2. 事件名包含中划线时，统一使用 `bind:xxx-yyy`。
3. 若要做批量替换到 `bind:xxx`，先确认最低基础库版本不低于 `2.8.1`。
4. wevu SFC 模板统一使用 `@event` 写法，避免混用原生 `bind:*` 风格。

## 7. 附：本次新增验证用例

1. `verifies bind event alias behavior for native view/native component/wevu sfc component`
2. `verifies triggerEvent hyphen/underscore event names with bind and bind: forms`

以上两条用例位于 `e2e/ide/lifecycle-compare.test.ts`。
