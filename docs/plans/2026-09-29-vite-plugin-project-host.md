# 微信插件双产物三入口对齐

本阶段继续 #1097 的三入口目标，依赖 worker 阶段 #1109；不关闭完整能力追踪项。

## 所有权与配置

- 微信插件项目复用父会话本次加载的配置与用户插件，创建独立 `CompilerSession`；删除旧全局活动上下文切换。
- 生产构建由主应用完成原生 write 后启动插件环境 `weapp_plugin`，防止嵌套插件输出被主应用的 emptyOutDir 清理。插件与 npm 子任务均完成后主构建才成功。
- worker 与插件共享唯一 app builder 登记点，避免多个 buildApp 钩子依赖彼此的调用顺序；主环境只构建一次。
- classic/stateful 主应用保留独立插件 watcher，由父会话负责关闭；插件更新不承诺状态保持。插件 manifest 改变时重建子会话入口图，子会话不会重新写 prepare 支持文件。
- 主应用增量不会清空嵌套插件目录；主应用自身删除仍交给发布清单撤销。输出目录等于或包含主应用目录时提前拒绝。
- 双产物暂不接受 build.write=false；标准插件的自定义 npm builder、手工映射等限制保持显式，后续继续对齐。

## 回归发现

- 插件 main 是 bundler 固定 input，不能被只包含动态 emitFile chunk 的增量集合误裁剪；仍按最终内容去重。
- 符号链接项目的配置路径与 bundler 真实路径可能不同。插件模板归属比较、manifest 监听使用真实路径，避免首次模板遗漏和 plugin.json 更新无效。
- 插件 manifest 的变更需要重建入口图，不能视为普通 JSON sidecar 更新后保留旧页面输出。失效操作会清掉扫描缓存，判断使用稳定的插件清单文件身份；异步重启纳入子会话待完成任务，关闭等待重启并释放替换后的 watcher。

- 插件重启会创建新的自动导入插件实例；替换侧车 watcher 前等待旧 watcher 关闭，避免覆盖登记后遗留句柄，导致独立 CLI 收到退出信号仍不结束。回归同时检查替换等待和单次输入监听归属。

## 验证

- 当前定向 8 文件 / 244 项通过：双产物构建、共享转换、配置不重读、输出目录冲突、输出保留、生产 watch 错误恢复与删除、classic/stateful 的同级/嵌套输出、manifest 删除/恢复、发布/重启中的关闭等待。
- 包级 typecheck、公开类型、构建、ESLint、网站构建、共享 automator 启动检查及 changeset 联动检查通过。
- 三入口严格 tarball 消费均通过安装、原生命令更新、页面删除/恢复及退出检查；每入口 headless 2 项、真实微信 IDE 2 项通过（运行时 error/exception 为 0）。消费 fixture 固定公开的 dayjs/sass 版本，不再从维护仓库 node_modules 推断版本。
- Vite+ 一次快速共享文件恢复检查未收到第二次更新；相同断言重新运行通过。额外纯宿主 watch 40 轮、插件 dev 40 轮快速修改均通过，暂未稳定复现；保留此观察，CI 继续跟踪，不能据此宣称完整可靠性矩阵完成。

## 文件拆分

既有 build service、core watch 与 autoImport 超过 300 行。本次新增编排放入 pluginProject.ts、appBuilder.ts 与 pluginProjectOutput.ts，既有大文件仅连接生命周期、manifest 失效和自动导入 watcher 替换处理；避免进一步嵌入整套子目标逻辑。
