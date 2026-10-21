---
"@weapp-core/constants": patch
"weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 明确状态保持 HMR 的支持边界，将不支持的配置、入口及运行时变更交回 classic 更新，并通过原始 Wevu 注册契约区分框架包装器与不可替换的用户闭包；由编译器提供冻结输入对应的模板注册签名，模板及外部模板的注册变化转交 classic，保留纯脚本与样式更新；新增独立 HMR 构建、headless 和真实微信 IDE 验收入口，并按同一提交核对完整场景与资源收尾。

修复 classic 外部模板修改和恢复时脚本依赖未同步失效的问题，避免新模板调用旧事件处理器；转换后的首次 classic 发布失败时停止开发会话并保留错误。

修复原生开发命令回退 classic 后的配置重载，保留对外事件通道并分别释放每代构建资源，让后续保存、恢复与关闭继续生效。

修复 Vite+ 在原生 TypeScript 转换前执行异步依赖分析时的解析错误，按宿主模块语言保留异步加载及分包路径改写。
