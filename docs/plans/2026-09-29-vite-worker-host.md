# worker 三入口编译对齐

## 架构

- 主应用的 worker publication 插件是三入口共同执行点。CLI 不另外启动 worker 构建或 watcher；worker 失败属于主发布事务。
- 原生 CLI 显式启用共享配置 app builder，worker 环境登记为 `weapp_workers`。主环境只构建一次；每轮 worker 子构建复用已加载配置、CLI 覆盖和用户插件，不再次执行配置文件。
- 子上下文不写支持文件，关闭时释放模块图；子构建 `write:false`、`watch:null`，返回原生编译产物。主应用通过 emit/write 写出所有 worker 文件。
- 生产 watch 接管精确依赖和 worker 根目录，支持错误恢复、新增导入、移除 worker 后删除产物。classic 复用既有 sidecar watcher；stateful 通过子目标输入元数据复用宿主 watcher，按完整批次更新，不承诺 worker 状态保持。
- 移除旧 worker 的 Rolldown watcher 加 chokidar add 事件再次启动 watcher 的重复所有权。独立分包的 stateful 输入观察抽象扩为 childSources。

## runtime 验证与 simulator

`e2e-apps/chunk-modes` 新增 worker 消息页面，保留原有 chunk matrix；三入口使用同一页面验证首条消息、复制后的消息往返、重新进入页面后的计数重置及实际 JS/JSON/WXML/worker 文件存在性。

mpcore 原先缺少 worker API。补充 Node/browser 共用消息、CommonJS 加载、独立缓存/全局对象、计时器与终止逻辑；对应 unit、浏览器 e2e 和公开类型覆盖。只声明已验证的消息及生命周期语义，不模拟真实线程性能、系统进程回收和实验性后端。

## 拆分评估

既有 build service 超过 300 行；本次移除独立 worker 启动和旧清理分支，将新增子目标逻辑放在 `workerPlan.ts` 与 `workerOutput.ts`。既有 Node/browser moduleLoader 与 wx 文件也超过 300 行；只连接执行器与 API，新增资源所有权集中于独立 `workerHost.ts`，避免复制两套消息协议。

## 验证状态

- 新 worker 4 项主线回归通过；共享生命周期、独立分包与插件定向 111 项通过。
- 扩展 stateful/插件/配置回归首轮 300 项通过，旧独立分包 mock 6 项失败；补齐 mock 并增加清理断言后 6 项重跑通过，修正单独交付 #1108。
- mpcore Node/browser 消息、终止与关闭后异步模块取消 3 项通过；浏览器回归 59 文件 / 118 项通过；最终改动后 worker 浏览器用例定向重跑通过。两包 typecheck 与公开类型通过。
- 新 worker suite 经 wv 的 headless 与真实微信 IDE 均通过，runtime error 为 0。
- wv、普通 Vite、Vite+ 均完成独立发布包严格 peer 安装、引擎身份检查、原生命令更新、headless 与真实微信 IDE 场景；三组最终 IDE runtime error 均为 0。普通 Vite 首次在 IDE 日志订阅阶段遇到启动故障，经 Computer Use 重启 IDE 后保持原断言重跑通过。
- 原有 worker/chunk 两项构建回归、suite manifest 30 项、DOM inventory 定向测试、网站构建及 changeset 检查通过。
- worker 的远端 CI 待提交后运行；总目标 #1097 仍未完成。
