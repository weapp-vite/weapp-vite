# 模拟器组件裸属性语义

零售模板的真实 IDE 对照通过，但 headless 在订单列表只渲染一个价格小数节点，预期为五个。四个整元价格对应的 `fill` 没有生效：可选 Boolean 经 Wevu 的 nullable transport 注册为原生 `type: null`，模拟器解析后将裸 `fill` 与 `fill=""` 都交付为空字符串。

在共享 WXML 解析边界保留 htmlparser2 提供的无值属性信息。Node 与浏览器的组件属性解析只对已声明的裸属性交付 `true`，显式空字符串、绑定空字符串、null、undefined、缺省及未知属性继续走各自现有路径。无需调整价格组件或 Wevu 的 nullable transport。

解析器 metadata 随节点克隆、循环及 include 传递，不额外扫描源码，也不改变通用属性值归一化。属性声明复用组件归一化的 Behavior 合并顺序，覆盖嵌套继承及短横线命名；渲染时只合并属性声明，不重复归一化 data 或生命周期。重复属性保持解析器现有首项规则，不以它作为原生 WXML 的有效使用契约。

共享原生 fixture 覆盖裸属性、显式及绑定空值、缺省、布尔值、属性命名、未知属性、循环与 include，并验证绑定更新和恢复。既有 property-delivery IDE suite 复用同一会话切换页面，将真实 IDE、Node 和浏览器的可观察结果进行对照；零售 parity 保留原来的五个小数节点断言。

修改后的组件解析文件均未超过 300 行。共享 metadata 留在已有解析模块，避免为单个条件拆散组件渲染职责。验证记录保留在任务状态索引中。
