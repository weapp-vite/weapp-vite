# Issue #1082：修正 42a CI 暴露的两项回归

被测 HEAD 为 `42a1b6fbc36f13a0692f217bc41283c7aabb2139`。两项失败均已完成编译与启动，不能按命令解析或路径错误处理。

## 资产监听测试的独立事件边界

[Ubuntu Node 22 job](https://github.com/weapp-vite/weapp-vite/actions/runs/36289970927/job/108538050988) 的 11572 项测试中只有 `runtime/watch/assets.test.ts` 一项失败：过滤器从排除变为包含后，测试立即再次写回排除内容，没有收到期望的 delete 通知。

已安装 chokidar 的 change 派发明确合并同一路径 50ms 内的事件。测试的第二次独立源写入可能落入该窗口；现与文件中既有失败恢复场景一致，在后续独立写入前等待 100ms。生产扫描、轮询间隔、过滤契约及性能采样均未改变，所有原断言保留。定向两项测试通过。

## Vue 兼容实例在卸载后的 exposed 视图

[Web E2E job](https://github.com/weapp-vite/weapp-vite/actions/runs/36289970914/job/108538050913) 在 Wot 的 sticky 页面离开、进入 swipe-action 时捕获 `Cannot read properties of undefined (reading 'stickyState')`。异步 resize 回调已持有组件实例，等待结束后继续读取 `child.$.exposed`；wevu teardown 已清除宿主 exposed 注册状态，兼容 getter 因而返回 undefined。

使用实际 Vue 3 自定义 renderer 的对照确认：卸载后，被持有实例的 exposed 对象仍保持身份和值。新增 wevu 排队回调回归先复现相同 stickyState 错误；另一项回归要求同一宿主再次挂载时不能复用旧视图。

`setupPhase.ts` 现在为 Vue 兼容视图单独保存 expose 对象，setup context 的 expose 同步更新此视图和宿主注册状态。teardown 仍清除宿主 key、响应式作用域及运行时注册；新挂载重新创建兼容视图。没有修改 Wot 源码、过滤 pageerror 或跳过断言。

保留的公开对象随被持有的实例引用存活，不由全局注册表新增持有；回调结束且实例不再可达时仍可回收。此改动仅对齐兼容视图，不把 Vue Web 的其他生命周期假设推广到原生宿主。既有大文件只调整该属性边界，新增回归独立成文件。

## 验证

- 卸载、模板引用、stateful HMR 等五文件 44 项测试通过；wevu typecheck/public types 通过。
- 重建 wevu、web 和 weapp-vite，确认浏览器解析的是当前 worktree 的产物。
- Wot sticky → sticky-box → swipe-action 的移动/桌面行为通过；随后完整 99 组件、两视口行为通过，33.07 秒。未更新视觉基线；原 CI 的视觉断言本身通过。
- 同一 Wevu 子组件脚本更新/恢复场景，headless 与真实 DevTools 均 6/6 DOM；分别 4.49 秒与 54.80 秒，前后检查没有其他 E2E。
- scoped ESLint 和 diff 检查通过，包含 wevu/create-weapp-vite 中文 patch changeset。

[脱敏归档](./issue1082-ci-exposed-lifecycle.json.gz) 解压 3300835 字节，SHA256 `dc9109c799828970e18916283bda42c82e0613a285b10c44cd0ff6d064d21539`。包含两个完整 CI job 日志、先失败/后通过回归、构建/类型与 Web/native 运行记录、DOM 及源码 hash。新 HEAD 的远端 CI 尚需独立验证。

这些局部修正不代表原生首次模板显示、TDesign 初始启动和完整性能门禁已通过；PR 继续草稿，目标仍是满足正式评审条件。
