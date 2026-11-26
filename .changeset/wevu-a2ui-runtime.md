---
"@wevu/a2ui": minor
---

feat(wevu-a2ui): 新增 A2UI 1.0 的 Wevu 渲染适配层，提供 surface 会话、视图投影、输入回写、catalog 函数扩展与动作外发。保留嵌套槽位节点，支持通过 bindingName/actionName 选择多个绑定或动作，失败的数据更新会回滚，异步动作与 Core 错误通过 onAction/onError 可靠传递；公开类型收敛为渲染所需契约，不再导出投影内部操作表类型。默认启用小程序安全的标准函数，支持 Checkable 校验结果投影，并在售后演示中展示与清除校验反馈。附带可运行的售后演示应用与真实 DevTools/headless runtime 验收。
