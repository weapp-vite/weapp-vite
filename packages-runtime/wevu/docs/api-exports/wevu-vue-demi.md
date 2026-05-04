# wevu/vue-demi 类型导出清单

- 子路径: `./vue-demi`
- 类型入口: `./dist/vue-demi.d.mts`
- 运行时入口: `./dist/vue-demi.mjs`
- 类型导出总数: **427**
- 仅类型导出数（推断）: **273**
- 运行时同名导出数: **154**

## 心智对齐补充

`wevu/vue-demi` 面向需要兼容 `vue-demi` 入口的库，导出内容基本等同 `wevu` 根入口，并额外提供：

1. `isVue2`
2. `isVue3`
3. `Vue2`
4. `install`

## 使用建议

- 业务代码优先从 `wevu` 根入口导入。
- 只有在兼容依赖要求 `vue-demi` 心智时才使用 `wevu/vue-demi`。
- 小程序运行时没有 Vue 2 实例，`isVue2` 固定为 `false`，`isVue3` 固定为 `true`，`Vue2` 为 `undefined`。
