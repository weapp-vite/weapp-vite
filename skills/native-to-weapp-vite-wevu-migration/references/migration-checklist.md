# Native -> weapp-vite / wevu Migration Checklist

## 迁移前

- [ ] 选定本轮页面族或组件族，只覆盖一个业务域。
- [ ] 明确目标：行为等价、可回滚、可验证。
- [ ] 记录关键路径：入口、操作、接口、异常。
- [ ] 盘点原生资产：`app.json`、页面、分包、组件、插件、wxs/sjs、npm、云开发、CI、DevTools 配置。
- [ ] 标记原生保留区、Vue 试点区和本轮不碰的高风险资产。
- [ ] 确认 Node / pnpm / weapp-vite / wevu 基线版本。

## 工具链接入

- [ ] 建立或修正 `vite.config.ts` 的 `weapp` 配置。
- [ ] 原生页面和组件在 `weapp-vite` 构建链路下仍可运行。
- [ ] 路径别名、静态资源、环境变量、npm 构建和输出目录已对齐。
- [ ] 已运行 `wv prepare`，`.weapp-vite` 支持文件稳定生成。
- [ ] `dev/build/open` 或对应 app 脚本形成最小闭环。
- [ ] AI 维护指引已提示先读 `AGENTS.md` 与 `dist/docs`。

## 共存试点

- [ ] 至少一个低风险页面或新页面使用 `.vue`。
- [ ] 原生页面继续可打开，Vue 页面可从原生页面进入或返回。
- [ ] 试点阶段未夹带全局状态、网络层、鉴权或视觉系统重写。
- [ ] 明确试点成功后下一批页面族。

## 机械迁移

- [ ] 将 `js + wxml + wxss + json` 合并到 `index.vue`。
- [ ] 使用 `defineAppJson/definePageJson/defineComponentJson` 维护配置。
- [ ] 保持函数名和调用顺序，先不改业务语义。
- [ ] 页面可打开，主流程可走通。

## 语义迁移

- [ ] `this.data` -> `ref/reactive`。
- [ ] `setData` 大对象回写 -> 直接赋值响应式状态。
- [ ] `properties` -> `defineProps`。
- [ ] `observers` -> `watch/watchEffect`。
- [ ] `triggerEvent` -> `defineEmits` + `emit`。

## 原生能力与多平台

- [ ] 原生实例方法通过 `setup(_, { instance })` 使用。
- [ ] 平台分支统一使用 `import.meta.env.PLATFORM`。
- [ ] 避免在业务代码散落 `wx/my/tt` 分支。

## 验证

- [ ] 单页冒烟覆盖正常/异常分支。
- [ ] 构建验证通过。
- [ ] 原生保留页面和 Vue 迁移页面都至少打开过一次。
- [ ] 定向 e2e 覆盖关键链路。
- [ ] e2e 已接入运行时错误采集。

## 回滚与交付

- [ ] 页面族粒度提交，可单独回滚。
- [ ] 变更说明记录迁移前后行为对照。
- [ ] 已定义触发回滚的硬条件。
- [ ] 回滚点区分工具链接入、试点页面、页面族迁移和语义升级。
