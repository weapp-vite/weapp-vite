# 自动路由解析器的构建生命周期

合并前核验发现，证据 PR #1083 的 Windows 普通 CI 在命名路由元数据保存场景失败：初次构建成功，随后解析外部 `@page-scripts/profile.cjs` 报 `Plugin driver is already dropped`，新元数据未写入产物。Ubuntu/macOS 同批任务通过，失败发生在运行中的文件更新阶段，安装和进程启动已经成功。

## 原因与修正

auto-routes 插件原先把构建钩子的 `this.resolve` 注册到长期服务。构建结束后，监听器、声明更新或其他调用仍可能使用该闭包，但对应的原生 plugin driver 已销毁。回归测试通过结束构建解析器生命周期，再触发后续刷新，复现了同样的错误。

修正将解析器所有权分开：服务保留自己持有的长期解析器；活动 `load` / `transform` 钩子仅向当前 `ensureFresh` 刷新传入构建解析器，不再覆盖服务状态。构建期间仍使用原生解析结果，后续监听不会捕获已结束的驱动。解析错误继续传播，没有通过吞错或延长轮询等待来绕过问题。

## 验证

- 新回归在修正前复现 `Plugin driver is already dropped`；修正后插件和服务两文件共 53 项通过，覆盖解析器不泄漏与失败后的后续刷新。
- `weapp-vite` 包级 typecheck、公开 test:types、build 通过；产物已重建。
- 原 CI 路由契约 6 项通过，含元数据单独保存、外部 CJS 更新、包导出重定向及声明生成。
- 命名路由 runtime 原 4 用例在 headless/真实 DevTools 均通过，各 6/6 DOM；覆盖初始异步守卫、移动后的名称导航、返回、abort/redirect 和无名称路径。
- 真实 IDE 首次预热没有完成，使用 suite 原有编译缓存清理和启动恢复后，4 用例全部执行并通过。恢复期间 engine HTTP 接口缺失、Tool.compile 不支持的日志完整保留，不能写成首轮冷启动全通过。
- scoped ESLint 与 diff 检查通过。已有大文件只调整刷新参数及解析器生命周期，复用现有测试夹具，不扩大无关重构。

中文 patch changeset 包含 `weapp-vite` 与 `create-weapp-vite`。这是构建解析生命周期修正，不代表 TDesign/Wevu 的其他启动、模板更新或数据一致性问题已解决。

## 证据

[脱敏归档](./issue1082-route-resolver-lifecycle.json.gz)包含 Windows 完整失败 job 日志、先失败回归、53 项测试、类型/构建/CLI 日志、两 provider 的 runtime 日志与 DOM 报告以及源文件 hash。

解压 612640 字节，SHA256：`15156c19bfe8b15860f2bd2462726ea01c31edc65099036fe8e1bdfb51069e70`。原日志 hash 单列；仅替换本机/runner 路径、AppID、邮箱和回环端口，合法的 `/pages/home/index` 路由保留。
