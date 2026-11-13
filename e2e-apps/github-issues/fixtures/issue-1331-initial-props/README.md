# setup 首帧给必填字符串属性传入空值

建议 Issue 标题：`[Bug]: computed／工厂状态绑定在首帧向必填字符串属性传入 null，需要模板兜底`

## 环境

- Node.js 24.22.2 / pnpm 12.18.0
- weapp-vite 7.10.0 / wevu 7.10.0 / @wevu/compiler 7.10.0（锁文件固定）
- 微信基础库 3.17.4，默认 WebView 页面
- 已在微信开发者工具模拟器实际复现，不依赖 Mango、后端、BLE 或业务状态

## 运行

在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
WEAPP_APPID=你的有效小程序或测试号AppID pnpm run repro:props
```

不传 `WEAPP_APPID` 时输出使用 `touristappid`，可用于构建及产物分析；使用自动化工具导入时可能被 AppID 校验拒绝，因此原生验收请使用自己有权限的 AppID。AppID 只通过环境变量传入，仓库不包含个人 AppID。

把 `examples/initial-props/dist` 导入微信开发者工具。项目配置由构建器生成，默认进入 `pages/raw/index`。

1. 冷启动无兜底页，观察 Console 中组件属性校验警告。
2. 点击“打开模板兜底对照页”，以 `reLaunch` 进入 `pages/guarded/index`，查看是否新增相同警告。
3. 点击返回无兜底复现页，再次观察警告增量。
4. 两页最终文字都应显示为“字面量初值”“就绪”“工厂初值”；问题发生在首次属性传入，而不是最终状态。

## 最小代码

两个父页面 setup 完全相同：

```ts
const literal = ref("字面量初值");
const label = computed(() => "就绪");
const createState = () => ({ label: "工厂初值" });
const state = reactive(createState());
```

无兜底页：

```vue
<StatusLabel :text="literal" />
<StatusLabel :text="label" />
<StatusLabel :text="state.label" />
```

对照页仅对后两处提供模板级兜底：

```vue
<StatusLabel :text="literal" />
<StatusLabel :text="label || ''" />
<StatusLabel :text="state.label || ''" />
```

子组件是普通 SFC，属性为**必填字符串**，且已有默认值：

```vue
<script setup lang="ts">
withDefaults(defineProps<{ text: string }>(), { text: "" });
</script>

<template>
  <text>{{ text }}</text>
</template>
```

必填是重要复现条件。7.10.0 会对可选属性启用空值容忍；仅把子属性写成 `text?: string` 的场景，本次没有触发相同的原生类型警告。

## 2026-11-13 实测结果

| 操作 | 相同属性警告累计数 | 最终页面数据 |
| --- | ---: | --- |
| 编译／刷新后进入 raw | 2 | 三个字段均正确 |
| reLaunch 到 guarded | 2（未新增） | 三个字段均正确 |
| reLaunch 返回 raw | 4（新增 2 条） | 三个字段均正确 |

原生警告原文（每次 raw 出现两条相同消息）：

```text
[Component] property "text" of "components/StatusLabel" received type-uncompatible value: expected <String> but get null value. Use empty string instead.
```

两个页面稳定后的数据均为：

```json
{
  "literal": "字面量初值",
  "label": "就绪",
  "state": { "label": "工厂初值" }
}
```

构建后的父页面初始 `data()` 只有 `literal`，没有 `label` 和 `state`；子组件仍生成 `type: String`、`required: true`、`default: ""`。这说明已有类型声明和子组件默认值不足以避免第一次空值传入。

## 预期结果

对合法的必填字符串绑定，应在首次原生属性校验前提供类型正确的初值，或协调 setup 数据发布和子组件创建时机，避免把尚未发布的值作为 `null` 提前传入。无需在编译期执行任意用户工厂；也不应通过取消必填约束、放宽原生类型检查或吞掉警告来掩盖问题。

临时绕过：在父模板加 `|| ''`。

## 上游定位

- [setupInitialData.ts](https://github.com/weapp-vite/weapp-vite/blob/weapp-vite%407.10.0/packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite/setupInitialData.ts) 只提取静态可序列化初值，不提取 `computed()` 和 `reactive(createState())`。
- [initialComputed.ts](https://github.com/weapp-vite/weapp-vite/blob/weapp-vite%407.10.0/packages-runtime/wevu/src/runtime/define/initialComputed.ts) 处理初始计算及运行时绑定占位。

以上是定位线索；本目录通过真实原生运行时的警告增量证明问题，不以源码匹配或假运行时替代。
