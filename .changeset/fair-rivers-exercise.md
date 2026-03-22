---
'wevu': patch
'create-weapp-vite': patch
---

为 `wevu` 增加页面级反馈宿主运行时能力，允许 layout 在自身组件内注册 `t-toast` / `t-dialog` 等共享反馈节点，并让页面与子组件在调用封装的提示/确认方法时优先解析当前页面 layout 宿主。同步恢复两个 TDesign wevu 模板以 layout 承载共享反馈节点，并补充对应的运行时与构建校验，避免再次出现 `未找到组件,请检查selector是否正确` 的告警。
