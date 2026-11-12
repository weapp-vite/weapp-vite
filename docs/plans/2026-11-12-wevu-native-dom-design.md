# Wevu TT 原生 DOM renderer

对应 Feature issue #1326，基于已合并 React PR #1319。

## 目标与边界

`weapp.wevu.renderer` 接受 `legacy`（默认）、`auto`、`native-dom`。首版只支持 TT Render Mode V2。其他目标的 auto 保持现有编译结果，显式 native-dom 报错。平台能力抽到独立的 runtime-safe shared 子入口，React 与 Wevu 使用同一探针和节点创建契约。

仅替换 setData adapter 仍会构建快照，而且没有可渲染节点；因此采用 SFC 编译目标与 runtime 同时适配。相比独立重写 keyed diff，Vue runtime-core 提供成熟的节点、条件、列表、组件与插槽语义。相比另建一份业务脚本，原生 render 与原有模板选项共用同一脚本作用域，避免顶层副作用重复执行。

## 编译与后端选择

为 TT 的 auto/native-dom 生成静态 ESM render，不在小程序动态编译。保留 legacy 模板用于 auto 回退。SFC 导出携带原生虚拟组件及注册委托，逻辑组件入口仍经过现有 createWevuComponent 注册；父 SFC 则直接消费虚拟组件。

opt-in 页面将 created/attached 等早期回调缓冲到 onLoad，在任何 setup 执行前探测 V2、appDocument、webview id 与页面文档。选定 native 后直接挂载文档；缺失能力时 auto 启用 legacy 模板并重放原生命周期，setup 只执行一次。此时 opt-in 页面的 setup 最早在 onLoad 执行；默认 legacy 的时机不变。

页面模板由内部可见性标记控制，初始隐藏，只有选择 legacy 才通过 setData 启用。native 分支不调用 setData。选定后出现宿主创建、插入、更新错误则上报，不允许部分挂载后切换。

## 响应式与生命周期

Wevu 拥有独立于 Vue 的响应式实现。每个原生虚拟组件使用 Wevu effect 收集 render 读取的依赖，并经现有 queueJob 调用结构 diff；等待 Vue 提交结束后完成该 job，使 Wevu nextTick 与更新钩子对应最终节点。子组件 props 进入 Wevu shallowReactive，上下文保留 attrs、slots、emit、expose 与父级 provide 链。

挂载、更新与卸载钩子接 Vue 提交边界，卸载停止 Wevu scope 并释放事件。原生组件标签走 TT createNativeComponent，SFC 子组件走虚拟组件；宿主节点移动不释放监听，真正移除递归释放。

首版未适配的编译语法或组合应明确诊断，不能静默输出不同语义。pageLayout/appShell 暂保留 legacy。

## 验证与交付

覆盖 fake TT 能力选择、节点增删/排序/身份、文本/属性/style 清除、事件捕获和解绑、SFC props/slots/emit、原生 bridge、生命周期、卸载及 native 不调用 setData。增加编译到 runtime 的链路覆盖和公开类型测试，运行相关包 typecheck、构建、legacy 回归及 lint。

当前没有抖音开发者工具，真实 TT runtime 验收待补；mock、构建、微信运行结果不得记作 TT 验收通过。中文 PR 关联 issue，不执行合并，保留原生 pr-ci-approval 门禁。
