---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-vite/hmr": patch
---

fix(weapp-vite): 将 package imports 的 query/hash 兼容处理内置到发布包，在主构建、子构建与 Web 路径自动接入，保留精确映射、条件、自定义解析器和 external 语义。

使用官方 Vite/Rolldown，隔离连续构建中的自有插件钩子容器，并在编译插件关闭后释放会话引用。

高级 tsconfigPaths 配置由内部创建的解析插件同样隔离每代 hook 容器，用户自行提供的同名插件保持对象与元数据语义。

编译 provider 终结时按注册所有权撤销 HMR 回调，避免配置重启删除或改名后继续调用旧 provider，同时保留新一代同名注册与快照资源生命周期。

状态保持快照在本轮产物生成时记录编译 provider 能力，保留构建关闭后的能力回退判断，并允许删除或替换 provider 后恢复。

Vite+ 模板和独立消费者同步使用官方 1.4.0 launcher/core 配对及其内置 Rolldown 1.2.15，并将 Vitest 固定到配套的 5.0.5；独立构建继续使用官方 Vite 8.3.5 和 Rolldown 1.2.16，不再依赖工作区 Vite/Rolldown 补丁。

开发宿主按每代所有权接管监听，启动和重启等待后端初扫或现存源码登记后再报告就绪；关闭先解除登记等待，再释放本代编译及监听资源，保留幸存 owner 和独立原生监听。

修补后的 Chokidar 继续随发布产物打包交付。公开产品生命周期契约作为完整硬门禁，原上游实现与引用回收诊断独立保留，失败仍非零退出；两者结果不互相替代。
