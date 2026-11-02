---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-vite/hmr": patch
"@weapp-core/constants": patch
"@mpcore/simulator": patch
"@weapp-vite/i18n": patch
"@weapp-vite/mcp": patch
"@weapp-vite/react": patch
"@weapp-vite/web": patch
"@wevu/compiler": patch
"@wevu/test-utils": patch
"@wevu/web-apis": patch
"wevu": patch
---

fix(weapp-vite): 将 package imports 的 query/hash 兼容处理内置到发布包，在主构建、子构建与 Web 路径自动接入，保留精确映射、条件、自定义解析器和 external 语义。

同步为 `@weapp-core/constants` 的公开直接依赖包发布补丁版本，使消费者的依赖范围随共享常量更新。

使用官方 Vite/Rolldown，隔离连续构建中的自有插件钩子容器，并在编译插件关闭后释放会话引用。

高级 tsconfigPaths 配置由内部创建的解析插件同样隔离每代 hook 容器，用户自行提供的同名插件保持对象与元数据语义。

编译 provider 终结时按注册所有权撤销 HMR 回调，避免配置重启删除或改名后继续调用旧 provider，同时保留新一代同名注册与快照资源生命周期。

状态保持快照在本轮产物生成时记录编译 provider 能力，保留构建关闭后的能力回退判断，并允许删除或替换 provider 后恢复。

Vite+ 模板和独立消费者同步使用官方 1.4.0 launcher/core 配对及其内置 Rolldown 1.2.15，并将 Vitest 固定到配套的 5.0.5；独立构建继续使用官方 Vite 8.3.5 和 Rolldown 1.2.16，不再依赖工作区 Vite/Rolldown 补丁。

开发宿主按每代所有权接管监听，启动和重启等待后端初扫或现存源码登记后再报告就绪；关闭先解除登记等待，再释放本代编译及监听资源，保留幸存 owner 和独立原生监听。

classic 构建的内部完成边界等待原生发布、样式收尾和已启动的 profile 写入；配置重启与关闭撤销旧代观察，失败后只有实际成功发布才能恢复采样，避免将未完成的构建计为资源验收通过。

修补后的 Chokidar 继续随发布产物打包交付。PR #1294 按用户授权引入两项持续的临时验收例外：Web optimizer 关闭残留，以及连续构建资源增长。两项均未修复；仅适用于固定官方 Vite 8.3.5 / Rolldown 1.2.16，版本变化时必需入口失败并要求重新评审或移除例外，不自动适用于 Vite+ 内置 Rolldown 1.2.15。

Web 扫描期间关闭或重启可能留下临时缓存；同一 Node 进程连续构建可能保留旧代编译引用并增加内存。classic 512 SFC / 14 次编辑的产物与 runtime 对照通过，但 RSS 增长 233.938 MiB、强制 GC 后 heap 增长 37.009 MiB，仍超过原 32/16 MiB 门限。该结果不证明线性增长、所有增长同因或 Vite+ 有相同资源表现。

Vite 必需产品入口固定执行五项并报告完整清单、豁免项和未执行项，通过时标记 accepted-with-waivers。原六项公开产品契约通过 diagnose:vite-product-lifecycle 保留，上游内部及引用回收诊断独立保留，原始失败仍非零退出。资源手动 workflow、原门限和断言不变；其他 CI、coverage、审查与真实 IDE 门禁不自动豁免，不能将例外写成问题已修复或完整验收通过。
