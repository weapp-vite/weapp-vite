# 原生组件挂载时的节点查询一致性

目标是在不改变 TDesign 代码或严格错误门禁的前提下，消除零售 headless 对照出现的 scoped root 查询 null。已捕获的 Promise 创建栈来自 Tabs attached 中的 getRect，而普通 attached 查询已有通过覆盖；最终失败节点位于地址编辑页的 Cascader 内部：关闭的 Popup 不投影 default slot，但其中的 Tabs 声明仍参与生命周期。

失败查询已记录页面、组件 scope、属性和实际渲染树。真实 IDE 对照确认普通与 virtualHost 的未投影声明仍可查询自身根，矩形为零；可见节点按实际尺寸返回。共享原生 fixture 对照普通与 virtualHost、可见与未投影声明的 attached 查询、缺失节点和重复 probe，并保留真实 IDE 顺序作为 contract。隐藏节点不能获得正的可见几何；缺失节点仍保持 null/空数组。

修复归属于模拟器的节点树或查询层；不吞厂商 Promise rejection，不统一制造矩形，不给生命周期追加固定延迟或重试。选择具备真实 runtime 证据、且使可见树、原生检查树与组件作用域保持明确归属的最小方案。复用现有 inspection 或 scope 能力优先于维护第二份重复树。

验证包含 Node/browser 单测、浏览器用例、相同原生场景的真实 IDE 对照、严格零售 headless 和相关既有 regression。源码变动后重建所属包。最终以干净最新 main 的完整 E2E 和严格终态门禁验收，先前失败证据保持原样。

## 实现边界

SelectorQuery 的 resolver 接受明确的组件 scope，在本次渲染树中先定位投影节点，再用已有 inspection 拓扑定位未投影声明；匹配仍局限组件自己的子树。未投影查询只把矩形设为零，缺失 scope 返回空结果，不回退整个页面。普通页面查询、canvas、observer 和其他共享 scope API 保持各自入口。

回调通过当前 runtime scheduler 的 nextTick 派发，保留 exec 的既有同步返回契约；request 与可选 callback 按相同索引登记，每次 exec 冻结 callback batch。销毁后的 scheduler 不再派发回调。真实 IDE 已确认 attached/end/ready 先于查询回调，后续缺失节点回调和 exec 回调保持请求顺序。共享原生 fixture 用独立节点身份、全部阶段完成屏障和精确序列锁定这些行为。

selectorQuery.ts 仍低于300行；Node/browser session 原本为较大的宿主编排文件，本次只传递scope上下文，不在此轮扩大拆分。
