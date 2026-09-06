---
"wevu": major
"@wevu/compiler": patch
"weapp-vite": minor
"create-weapp-vite": patch
---

将 Wevu 的 JSX 原生元素类型改由微信、支付宝、抖音及三端公共子路径分别持有。中性入口不再默认暴露微信原生标签，旧的根入口平台类型、HTML 别名、原始宿主事件名和宽泛属性签名已移除；项目配置会按目标平台选择对应的类型入口，运行时渲染结果不变。

自动导入的普通与泛型 Vue SFC 保留源文件必填属性、事件参数和 JSX 宿主属性，便携类型提取正确识别泛型、mapped 与 infer 的局部作用域；同时补齐 picker 数组类型、抖音 picker 的模式与日期时间属性，并同步 HTML 提示元数据及 TSX 类型回归覆盖。

完整执行发布入口的 TypeScript 与 TSX 类型回归，补齐只读返回值、空 setup 组件实例、宿主查询类型导出及 Store action 订阅上下文的类型契约；自动导入声明通过真实 SFC/TSX 消费者验证，不再依赖生成器内部 helper 文本。
