# 标准插件生产 watch 阶段

关联 #1097，叠加在 classic dev 阶段之上。三入口完整能力对齐仍是最终目标；本阶段新增普通 Vite 和 Vite+ 的原生 `build --watch`。独立 CLI 保留现有 `wv dev/build`，不新增宿主没有承诺的 CLI 参数。

## 生命周期与产物边界

- Vite 每轮 watch 构建都会触发 `closeBundle`；会话仅在 `closeWatcher` 关闭，普通一次性构建仍在 `closeBundle` 释放。
- 每轮重新校验目标并准备 npm 产物；失败可恢复，宿主 watcher 的关闭等待原生写出完成。
- 静态输入只保留真实 app，页面及组件由每轮入口扫描登记。删除首次构建已有的页面也不会被静态 input 继续引用。
- 生产 watch 发布完整目标快照，模块转换缓存与 JSON/WXML/CSS 等产物缓存分开处理。每轮重置已发出缓存和样式附属文件集合，重新登记当前入口。
- 使用现有产物所有权清单清理已删除页面与 sourcemap；`emptyOutDir: false` 时保留非本会话产物。产物继续由原生 emit/write 写出。
- 自动路由目录登记真实路径，覆盖符号链接根目录；首轮语法错误前登记源码依赖，确保修复后能继续构建。
- 配置仍由宿主只加载一次。生产 watch 修改宿主配置后需重启；配置自动重启由 classic dev 路径负责。

## 回归与消费验收

`test/vite-watch.test.ts` 覆盖三组真实 watcher 场景：手动/自动路由、清空/保留输出、首轮/后续语法错误恢复、模板样式脚本更新、完整 JSON/WXML/JS/sourcemap/npm 产物、页面新增删除、删除首次输入页面、目标不支持错误恢复、非本会话文件保留、等待在途 writeBundle 关闭。

独立 tarball 消费验证使用严格 peer 安装，分别执行原生 `vite build --watch` / `vp build --watch` 的 TS 与 Vue 更新，同时验证配置仅执行一次。沿用 `wv` 独立消费门禁。

`hmr-auto-classic.runtime.test.ts` 增加 `vite-watch` 入口，与现有 `wv`、`vite dev` 复用 fixture 和 DOM/runtime 断言；按 provider 分别运行 headless 与真实微信 IDE。未新增页面，沿用真实 AppID 与页面条件。DOM 清单测试同步新增入口。

## 维护与后续

既有 `useLoadEntry/index.ts`、`loadEntry/index.ts`、`autoRoutes.ts` 等超过 300 行，本次只增加与现有私有状态同所有权的重置/登记边界；避免为本轮 watch 复制另一套编译器。后续完整能力对齐时按入口计划与增量调度继续拆分。新增 watch 集成测试低于 300 行。

本阶段不开放 stateful、React、worker、独立分包、插件双产物、lib、其他平台/Web。它们仍在总追踪项中，不能将当前 watch 通过标记为最终三入口能力对齐。

## 本轮验证记录

- 包级 typecheck、公共类型契约通过。
- 定向编译、入口、classic 与 watch 回归共 383 项通过（18 个文件 321 项与入口登记 62 项分批验证）。
- 独立 tarball Vite 8.3.1 与 Vite+ 1.0.0 严格安装、普通构建、classic dev、TS/Vue 原生 watch 更新通过。
- 新增 watch runtime 场景在 headless 和真实微信 IDE 各通过 1 项；IDE 更新后重连遇到一次模拟器启动错误，基础设施自动恢复后完成全部原断言。
- DOM 清单 6 项、共享 IDE 启动检查、changeset 联动检查、ESLint 与网站构建通过。
- Vite+ 具备独立发布包 watch 证据；不将普通 Vite 的 IDE 验收冒充 Vite+ 专属 IDE 验收。
