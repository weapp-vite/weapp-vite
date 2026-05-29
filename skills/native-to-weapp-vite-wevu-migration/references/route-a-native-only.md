# Route A: weapp-vite + Native Mini-program

## 目标

让存量原生小程序保留 `Page/Component + WXML/WXSS/JSON` 开发模型，同时接入 `weapp-vite` 的现代工程链路。

这条路线不是“迁移到 Wevu 前的半成品”。如果团队当前只需要构建、TypeScript、路径别名、资源处理、DevTools、截图日志、AI 协作和 CI 收益，路线 A 可以作为明确交付终点。

## 适用场景

- 存量页面数量多，短期不能承担 Vue SFC 改写成本。
- 项目依赖复杂插件、`wxs/sjs`、云开发、地图、直播、支付或老旧 Behavior。
- 团队希望继续维护原生小程序写法。
- 当前主要痛点在工程链路，而不是页面状态模型。
- 希望先建立可验证、可回滚的现代化基线，再决定是否进入路线 B。

## 必做事项

- 盘点 `app.json`、页面、分包、组件、插件、npm、云开发、CI 和 DevTools 配置。
- 新增或修正 `vite.config.ts` 的 `weapp` 配置。
- 保持原生页面和组件目录结构，不做业务重写。
- 对齐路径别名、静态资源、环境变量、npm 构建和输出目录。
- 运行 `wv prepare`，确认 `.weapp-vite` 支持文件稳定。
- 将 `dev/build/open/screenshot/compare/ide logs` 或项目等价脚本写入维护文档。
- 至少验证一条关键链路：构建成功、DevTools 可打开、页面可进入、无新增 runtime error。

## 不做事项

- 不因为接入 `weapp-vite` 就新增 `wevu` 依赖。
- 不因为迁移计划存在就把原生页面改成 `.vue`。
- 不把全局状态、网络层、鉴权、埋点或视觉系统重构塞进工具链接入波次。
- 不把路线 A 的验收标准写成路线 B 的 `.vue` / 响应式完成度。

## 退出条件

- 原生页面、组件、分包、插件和 npm 依赖在 `weapp-vite` 链路下行为等价。
- `dev/build/open` 或项目内等价脚本稳定可用。
- `wv prepare`、`.weapp-vite` 支持文件、AI 指引和本地随包文档接入稳定。
- 路径别名、环境变量、静态资源、DevTools 项目配置和 CI 命令已对齐。
- 关键链路有可复现的构建、打开、日志或截图验收。

## 进入路线 B 的触发条件

- 新页面希望使用 Vue SFC 组织代码。
- 目标页面族长期维护成本高，`setData` 大对象和隐式组件契约成为主要问题。
- 团队已接受 `wevu` 运行时和 `<script setup lang="ts">` 心智。
- 已选定低风险试点页，并能保留原生页面回滚点。
