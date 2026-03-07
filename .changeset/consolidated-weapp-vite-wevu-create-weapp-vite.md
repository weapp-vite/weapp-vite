---
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

整合同时影响 weapp-vite、wevu 与 create-weapp-vite 的 changeset。

## 合并来源
- eager-crews-cough.md
- odd-horns-repeat.md
- quiet-donuts-wave.md
- rich-foxes-walk.md

## 变更摘要
1. **eager-crews-cough.md**：为 `weapp-vite` 新增 `weapp.wevu.preset: 'performance'` 预设，并将 `autoSetDataPick` 与预设联动（可被显式布尔配置覆盖）；同时为 `wevu` 增加 `setData.highFrequencyWarning` 开发态高频调用告警能力（默认关闭，可按阈值开启与调优）。此外同步补充 website 配置与 runtime 文档，明确预设内容、覆盖规则与 FAQ。
2. **odd-horns-repeat.md**：为 `wevu` 新增 `useUpdatePerformanceListener()` 组合式 API：可在 `setup()` 中注册 `setUpdatePerformanceListener`，并在 `onUnload/onDetached` 自动清理，返回 `stop` 句柄支持手动停止；同时补齐 `SetupContextNativeInstance` 的对应类型桥接与导出覆盖测试。 同时增强 `weapp-vite` 的 `weapp.wevu.preset: 'performance'` 默认值：在保留 `patch + suspendWhenHidden + highFrequencyWarning` 的基础上，默认追加 `diagnostics: 'fallback'`，便于开发态更快定位 `setData` 回退与体积问题，并补齐相关单测与配置注释。
3. **quiet-donuts-wave.md**：修复 `wevu` 的 `props -> properties` 归一化能力缺口：新增对 `optionalTypes` 与 `observer` 的透传，数组类型会规范化为 `type + optionalTypes`，并在缺失 `type` 时回填 `null` 以贴近小程序 `properties` 语义。同时修复 `weapp-vite` 自动组件元数据提取逻辑，`json.properties` 现在会合并 `type` 与 `optionalTypes` 生成联合类型，避免 typed-components/html custom data 类型信息偏窄。
4. **rich-foxes-walk.md**：为 `wevu` 新增 `useRouter()` 与 `usePageRouter()`：在 `setup()` 中可直接获取小程序 Router，并优先保持 `this.router / this.pageRouter` 的原生语义。针对基础库低于 `2.16.1` 或实例路由器缺失场景，运行时会自动回退到全局 `wx` 同名路由方法；同时补齐 `SetupContextNativeInstance` 的 `router/pageRouter` 类型声明，并引入可声明合并的 `WevuTypedRouterRouteMap`，支持按项目路由清单收窄 `url` 类型。 `weapp-vite` 的自动路由产物 `typed-router.d.ts` 现已自动注入对 `wevu` 的模块增强：当启用 `autoRoutes` 后，`useRouter()/usePageRouter()` 的 `navigateTo/redirectTo/reLaunch/switchTab` 会继承 `AutoRoutesEntries` 联合类型（并保留相对路径写法），降低路由字符串拼写错误风险。同时 `weapp-vite/auto-routes` 新增 `wxRouter` 导出，提供一组代理到全局路由 API 的类型化方法，便于在业务代码中直接获得路由参数约束。
