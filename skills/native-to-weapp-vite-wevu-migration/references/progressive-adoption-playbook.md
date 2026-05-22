# Progressive Adoption Playbook

## 目标

让原生小程序先享受 `weapp-vite` 的现代化工具链，再按风险可控的节奏迁到 `wevu + Vue SFC`。

核心判断：迁移不是一次性重写。工具链接入、页面共存、组件迁移、响应式升级、e2e 验证可以分开交付。

## 阶段 0：原生项目体检

- 读取 `app.json`、分包配置、页面列表、`usingComponents`、插件、npm 依赖和 CI 命令。
- 标记高风险资产：复杂 `wxs/sjs`、原生插件、云开发、地图/直播/支付、跨页面共享实例、全局 monkey patch。
- 标记低风险试点：新页面、内部页面、展示页、无复杂宿主 API 的组件。
- 记录当前 DevTools 打开方式、构建输出目录、预览/上传流程。

## 阶段 1：工具链接入优先

目标是“不改业务行为，只替换工程入口”。

- 新增或修正 `vite.config.ts` 的 `weapp` 配置。
- 保留原生页面和组件目录结构，先让 `dev/build/open` 产物等价。
- 接入 `wv prepare`，确认 `.weapp-vite` 类型和 AI 支持文件生成稳定。
- 对齐路径别名、静态资源、环境变量、npm 包构建、输出目录和 DevTools 项目配置。
- 建立最小验证：构建成功、DevTools 可打开、首页可进入、关键接口无新增 runtime error。

## 阶段 2：原生与 Vue SFC 共存

目标是证明迁移可以逐页发生。

- 旧页面继续保留原生 `js/wxml/wxss/json`。
- 新页面或试点页面使用 `.vue`、`definePageJson` / `definePageMeta`。
- 路由、分包、tabBar、usingComponents 以 `weapp-vite` 配置和 JSON 宏为单一来源。
- 不在试点阶段重写全局状态、鉴权、网络层或视觉系统。
- 通过页面跳转验证原生页面和 Vue 页面互通。

## 阶段 3：页面族迁移

目标是按业务闭环迁移，而不是按文件类型横切。

- 一个波次只迁一个页面族和它直接依赖的组件。
- 先机械合并 `js/wxml/wxss/json` 到 `.vue`，保持函数名、字段名和调用顺序。
- 再把 `properties/triggerEvent/observers` 改为 `defineProps/defineEmits/watch`。
- 最后把高频 `setData` 改为响应式状态；低频桥接可以临时保留 `instance`，但要记录退出条件。
- 每波次结束必须能构建、打开、走通主路径并对比关键页面。

## 阶段 4：语义升级

目标是把迁移收益真正兑现到长期维护。

- 用 `ref/reactive/computed` 替代大对象 `setData`。
- 用类型化 props/events 固化组件契约。
- 用 `definePageMeta`、layout、autoRoutes 收敛路由和页面元信息。
- 用 `import.meta.env.PLATFORM` 收敛多平台差异。
- 将 AI 指引、截图、日志、e2e 命令写入项目维护约束，避免迁移后靠口头记忆维护。

## 回滚边界

- 工具链接入波次：回滚 `vite.config.ts`、脚本、生成支持文件和 DevTools 配置，不碰业务代码。
- 试点页面波次：回滚新增 `.vue` 页面和路由注册，不影响原生页面。
- 页面族波次：按页面族提交，避免共享组件迁移污染多个业务域。
- 语义升级波次：保留迁移前行为基线和截图，发现行为漂移时先回退语义升级，不回退已稳定的工具链。

## 最小验证矩阵

- 工具链接入：`pnpm --filter <app> build`，必要时 `pnpm --filter <app> open`。
- 试点页面：构建 + 页面打开 + 原生页和 Vue 页互跳。
- 页面族迁移：构建 + 关键交互 + runtime error 日志检查。
- 视觉敏感页面：截图 + `wv compare`。
- DevTools 相关问题：使用 IDE e2e 或 `wv ide logs --open` 验证真实运行时。
