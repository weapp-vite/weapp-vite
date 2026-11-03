# WXML 静态空白与真实微信运行时对齐

全量 Stable 验收发现，格式化夹具的 WXSS 子级 ID 选择器无法编译。将目标改为 class 后，真实页面进入断言，进一步暴露了模拟器与微信之间的空白差异。

同一 Stable 安装、同一受管窗口中的原始页和格式化页均观察到：标签间静态单空格、连续空格和换行不产生文本，纯空白的 text 节点内容为空；显式 `{{' '}}` 产生一个空格，含非空字符的文本保留原有前后及连续空格。原生页面截图与协议读取一致。该结果决定本次修复范围。

统一在模板解析后、插值前移除静态 ASCII 纯空白节点。Node、browser 和 testing fallback 共用已有模板 parser，避免分别修改文本读取、序列化或渲染后的结果。保留 WXS 正文、注释、非空文本及动态表达式；不扩大到未经验证的其他 Unicode 空白。

共享格式化夹具同时保留静态分隔、显式动态分隔、纯空白及非空连续空格四类场景。真实 IDE、Node/browser session 与浏览器 DOM 使用相同语义；格式化前后仍比较全部交互状态、事件、分支、循环和样式。

回归覆盖 parser 的快速路径与恢复路径、动态空白更新、testing fallback，以及真实浏览器序列化。内部实现不新增公开 API；运行现有公开类型检查。验证后重建 simulator，再运行 headless 和真实 Stable 格式化场景。原始编译失败和错误空白假设分别保留，局部通过不替代最新主线完整验收。

DOM checkpoint 原有文本读取会 trim，不能验证两侧空格。选择增加可选 `textWhitespace: 'preserve'`，在文本读取后直接比较并保存原值；既有 checkpoint 仍按原规则执行。另一种方式是在格式化 suite 单独添加原文断言，但那会让报告中的文本证据与实际断言分离；全局移除 trim 则会扩大既有场景的行为范围。共享格式化契约使用精确模式，工具回归同时覆盖空字符串、单空格、非空前后空格及错误结果被拒绝。

Stable 配套 SDK 3.17.5 的 `Element.getStyles` 从 computedStyle 长属性列表取值，无法读取 `white-space` 简写。原始页与格式化页的实际结果均为 `white-space-collapse: preserve` 与 `text-wrap-mode: wrap`。真实 IDE 改为同时验证这两个等价长属性，浏览器仍直接验证 `whiteSpace === 'pre-wrap'`；继续保留文本原文、交互与 rpx 断言。未知文本模式在注册和序列化两层拒绝。

真实宿主会在 `page.data()` 中注入各页面独立的 `__webviewId__`。跨页比较只排除这一宿主标识，保留所有应用字段；页面身份和路由仍在每个 DOM checkpoint 中独立校验。simulator 修复同时进入 automator 的内联发布产物，因此两个包都显式记录 patch changeset。

既有 checkpoint 和报告测试文件超过 300 行；本次保持小范围契约修复，避免把文件拆分混入运行时差异修复。后续可独立按职责拆分。
