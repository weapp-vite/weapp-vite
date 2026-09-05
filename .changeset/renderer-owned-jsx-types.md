---
"wevu": major
"@wevu/compiler": patch
"weapp-vite": minor
"create-weapp-vite": patch
---

将 Wevu 的 JSX 原生元素类型改由微信、支付宝、抖音及三端公共子路径分别持有。中性入口不再默认暴露微信原生标签，旧的根入口平台类型、HTML 别名、原始宿主事件名和宽泛属性签名已移除；项目配置会按目标平台选择对应的类型入口，运行时渲染结果不变。
