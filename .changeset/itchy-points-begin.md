---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu/router` 增加 `paramsMode` 选项（`loose | strict`，默认 `loose`），用于控制命名路由 `params` 的容错行为：`strict` 模式下会校验并拒绝未被路径模板消费的多余参数，减少参数误传导致的隐性导航问题。同步补充运行时与类型测试覆盖。
