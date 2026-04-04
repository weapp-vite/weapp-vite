---
name: weapp-vite-vue-sfc-best-practices
description: 面向使用 weapp-vite 的小程序项目的 Vue SFC 实践手册，覆盖 `<script setup lang="ts">`、JSON 宏、`definePageMeta`/layout、`defineModel`、`usingComponents`、模板指令兼容、`.weapp-vite` 类型支持文件、受管 `prepare` 工作流，以及和脚手架 `AGENTS.md` / 本地 `dist/docs` 对齐的当前 SFC 约定。
---

# weapp-vite-vue-sfc-best-practices

## 用途

在小程序项目里用 Vue SFC 写出“编译可预测、运行时可验证、类型可跟上”的页面和组件。

## 何时使用

- 用户问 `.vue` 文件应该怎么写。
- 用户问 JSON 宏和 `<json>` 怎么选。
- 用户问 `definePageMeta` / layout 怎么配。
- 用户遇到模板兼容或编译错误。
- 用户遇到 `.weapp-vite` 类型输出、组件声明或 route type 漂移。

## 不适用场景

本 skill 聚焦 SFC 编写和编译期兼容。

- 项目级构建配置：使用 `weapp-vite-best-practices`。
- `wevu` 生命周期和 store：使用 `wevu-best-practices`。
- 迁移规划：使用 `native-to-weapp-vite-wevu-migration`。

## 核心流程

1. 先判定问题阶段：
   - 编译期：宏、模板、`usingComponents`
   - 运行期：事件、hooks、响应式
   - 工具层：Volar、`.weapp-vite`、typed outputs
2. 默认使用 `<script setup lang="ts">`。
3. JSON 优先走宏：`defineAppJson`、`definePageJson`、`defineComponentJson`；页面元信息走 `definePageMeta`。
4. 套用模板兼容规则：
   - `v-model` 只能作用于可赋值左值
   - 不要假设 Web Vue 的所有模板特性都可用
   - `usingComponents` 走 JSON 宏 / 自动导入，不走 Web Vue 注册思路
5. 若 `typed-router.d.ts`、`typed-components.d.ts`、`components.d.ts` 漂移，先跑 `wv prepare`。
6. 若项目有根 `AGENTS.md` 或本地 `dist/docs/vue-sfc.md`，SFC 写法要与其约束一致。

## 约束

- 不要在一个 SFC 里混多套 JSON 宏。
- 不要把小程序组件注册当成 Web Vue 组件注册。
- 不要忽略 `prepare` 和 `.weapp-vite` 产物。
- 不要在修 SFC 语法时顺手做无关运行时重构。

## 输出

应用本 skill 时，输出必须包含：

- 问题阶段诊断。
- SFC 级改动建议。
- 模板兼容注意点。
- 最小验证命令。

## 完成标记

- 宏使用清晰且单一。
- 模板没有踩不支持语法。
- `usingComponents` 路径安全、来源明确。
- `.weapp-vite` 支持文件和类型输出已同步。

## 参考资料

- `references/macro-config-checklist.md`
- `references/template-compat-matrix.md`
- `references/troubleshooting-playbook.md`
