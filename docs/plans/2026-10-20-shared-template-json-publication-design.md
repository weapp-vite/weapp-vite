# 共享原生模板的 Vue JSON 发布

## 证据与复现

真实 IDE 0137 的原始观察中，同一个 SFC 页面在冷构建时的 JSON 含两个 layout 绑定；共享原生模板发生 marker 修改后，JSON 变为仅含自动组件。SFC 源码未修改，已采集 JS 内容相同。观察器存在采样间隔，因此这些证据不能单独证明 JSON 变化就是页面重载的唯一原因。

仓库内 source integration 使用真实 compiler context 和 Vite build，复用插件完成冷构建、共享 marker 修改、自动组件删除、恢复，以及模板入口移除原生依赖五代构建。内联 SFC 和外部模板分别覆盖同一场景：一个原生页面和一个 SFC 页面共同 import 原生模板；自定义标签只位于共享模板，SFC 显式声明另一个组件，并使用 default/admin layout。首次执行记录了九处失败：SFC 没有进入共享文件的 affected graph，冷 JSON 缺少共享组件，暖 JSON 丢失 layout，marker 修改前后 JSON 不同。

## 所有权和数据流

SFC loader 在自动组件增强前通过现有 WXML 扫描服务解析原生 import/include/WXS，等待递归扫描完成，再从本轮模板图登记传递 template/WXS 依赖。纯 import 模板也进入这条路径；移除全部候选时替换为空依赖，避免继承上一代边。逻辑入口同样从当前 SFC 模板图重建侧车，而不保留旧模板边。直接组件的 script setup 分析继续复用已有分析器。

JSON 发布所有者记录在内部 emit record，不修改公开 Entry 类型。真正的 Vue page/component，包括未被 React 接管的 JSX/TSX，由 Vue compiler 发布最终 JSON，core 不再先发布一个不完整版本。原生脚本即使有配对的 Vue 配置回退，也继续由 core 发布；关闭 Vue、React JSX 和 App 配置沿用各自既有所有者。

最终配置只使用当前 loader 的增强结果和当前 compiler 结果。compiler 已处理源码声明、用户 JSON 合并策略、layout 和 slot 配置；合成时仅补 loader 相对源码声明新增或改变的当前组件绑定，不读取旧 bundle，也不再次执行用户策略。这样不会复活 replace 或自定义策略已删除的声明。没有 compiler JSON 片段时，使用当前入口配置。派生绑定的删除来自新一代输入，不通过合并旧产物来保留字段。

scoped slot 和 fallback wrapper 的资源处理还会向 compiler result 的 usingComponents 追加生成组件绑定，因此最终合成位于资源及样式处理完成后、唯一 JSON 发布前。原生或未注册 owner 是否合并已有 JSON，仍依据资源处理前有没有 compiler config 决定；不能因后续资源首次生成 config 而误删原生发布者保留的页面标题或手动组件。此边界继续使用原有合并策略，不新增发布者。

## 外部模板来源与路径

模板的实际来源使用已有 resolver 回执记录在当前解析选项的 WeakMap 中，按 importer 和原始 src 区分；不按扩展名推测 block 类型。编译器即使命中 SFC 描述符缓存，也重新解析外部块。alias 模板的同源码、新选项、内容修改和目标迁移三代测试确认每代记录都来自当前 resolver，而不是上代绝对路径。

loader 扫描原始模板内容时，将其中相对 import/include/WXS 重定位到 SFC 所在目录。编译结果在宿主消费边界做相同的路径处理，使后续图登记和最终 emit 使用一致路径；不修改原模板、descriptor 定位或编译器脚本 sourcemap。现有通用 block readFile 钩子不能区分模板和脚本/样式，编译前改写还会改变原始诊断偏移，因此不通过该钩子转换源码，也不扩展编译器公开 API。

编译结果包含源码依赖和编译器自产 WXS 两种来源。只有结果明确声明 classStyleWxs，并且 WXS module 使用共享常量 WEVU_CLASS_STYLE_RUNTIME_MODULE 时，才保留编译器已按输出目录计算的路径；普通 WXS 即使具有同一 src 值也正常重定位。scoped-slot 的模板结果同样处理；其现有 emit 规则是在 owner 基名后追加 scoped-slot 后缀，目录与 owner 相同。source build 同时包含原生 WXS 和动态 class/style，并核验两类引用最终都存在对应文件。

## 边界与验证

单元测试覆盖 Vue/native/React/禁用 Vue 的发布边界、唯一 core 发布者、当前声明和编译派生配置保留、自动组件与 layout 删除恢复、用户合并策略删除不被复活、递归模板及 WXS 失效和空边替换。合法的 paired Vue 配置通过原生 loader 和真实提取器验证：原生脚本消费配置，原生 WXML 仍为模板来源，core 仍为 JSON 发布者，配对 Vue 不被额外编译。此边界没有通过给 app.pages 添加脚本扩展名来强制选择入口，避免测试产生宿主不接受的路由。

source integration 同时断言完整预期 JSON、marker 修改前后最终字节、组件删除恢复、真实 affected graph、移除 import 后旧 shared/include/WXS 边不复活、有效 app 路由，以及页面、组件、layout 和两类 WXS 的宿主输出文件存在。

候选验证覆盖 23 个相关测试文件、398 个测试；包范围 TypeScript noEmit 和所有改动源码/测试/设计文档的 ESLint 通过。最后补充的第五代配置删除断言另行重跑 source integration 通过。此处没有修改公开类型、独立样式文件或 Vue 样式块，不新增 tsd 或 stylelint 范围。

独立审查后新增 5 项真实资源发布回归：registered page/component 分别在 override/replace 下经过实际 emitCompiledEntryBundleAssets，验证两种晚期组件绑定、生成产物、loader 绑定与编译器删除语义、下一轮删除不复活以及唯一 owner JSON；另验证原生 owner 无初始 compiler config 时仍合并已有配置。前四项在原候选全部失败，最终 JSON 同时缺 scoped slot 和 fallback wrapper 绑定；将合成移后并保持初始合并决定后，相关 5 文件、91 项测试以及包范围 noEmit、针对性 ESLint 通过。这些 source 结果仍不计入真实 IDE 通过数。

仅补依赖图后，首次九处失败缩减为三处共享组件丢失，定位到最终 Vue JSON 覆盖 loader 自动绑定；补齐发布所有权与当前输入合成后，五代 source integration 通过。外部模板动态 class/style 的回归还复现了统一重定位导致样式辅助 WXS 指向不存在文件的问题，按明确的编译器归属保留路径后通过。上述结果不代替真实 IDE 0137 的最终验收，后者由主任务在主工作树同步并重建后串行执行。

已有 loader、emit、core bundle 和 assets 文件超过 300 行，bundle compile 文件为 302 行。本次将模板图遍历、JSON 发布选择、配置合成、外部模板身份和路径处理分别提取为小模块，logical-entry 因抽出图遍历降至 298 行；大文件中仅保留原有生命周期入口与调用，避免为这一回归重组整个插件。公开 Entry 类型未改；publisher 仅属于内部 JsonEmitFileEntry，不增加消费者类型契约。
