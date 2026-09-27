# PR #1086：TDesign 默认 layout 启动对照

产品提交仍为 `bad3afc8702b6606f6de8fd861d0c305f487d2a7`。新的有效对照是：关闭首页默认 layout 后，原 TDesign 颜色用例通过 5/5 DOM 检查点；完整 stateful 配置仍未通过。该对照用于缩小范围，不把关闭 layout 当作修复。

## 对照结果

所有 TDesign 对照均保留原颜色、主题切换、页面身份和状态断言；仅在临时 fixture 或明确标注的临时编译分支中改变输入。运行串行，全部失败继续保存。

| 对照 | 结果 | 解释边界 |
| --- | --- | --- |
| 移除首页 TDesign/HelloWorld 子组件，保留业务脚本和默认 layout | 启动失败，0 DOM | 产物确认只引用默认 layout，不能只归因 TDesign 子组件 |
| 不带前导 `/` 的 route rule | 启动失败，0 DOM | 产物仍含 layout，规则没有匹配；这是无效关闭对照，不参与因果判断 |
| `/pages/index/index` 的 `appLayout: false` | 1 case、5/5 DOM 通过，67.75s | 启动前明确断言 WXML 和 JSON 均无默认 layout；Page/App 身份和暗色状态保持，运行时无错误 |
| 默认 layout 的 `Component({})` 改为函数别名调用 | 读取当前页超时，0 DOM | 原 layout 保留；此项自身没有证明 SDK 注册语义完全等价 |
| 仅去掉原生 layout 包装上的 owner 属性 | 启动失败，0 DOM | 输出确认 layout 与 TDesign 组件保留，`__wvSlotOwnerId` 属性消失；临时编译分支已恢复 |
| 移除子组件，将 Page 脚本缩减为 mode/切换方法 | 启动失败，0 DOM | 仅引用默认 layout；原生链接仍有未触发的 copy 绑定，不把此输入当最终回归 fixture |
| 原完整页面启动前清理编译缓存 | 启动失败，0 DOM | 单独清理缓存未恢复完整场景 |
| 原完整页面使用 classic 构建运行时 | 页面预热成功；随后样式产物前置检查失败，0 DOM | classic 的页面 WXSS 不包含沿用的 stateful 标记；不能把预热成功写成完整颜色用例通过 |
| 不经过构建器的原生 slot 源码项目 | headless 2/2、真实 IDE 2/2 DOM 通过 | 覆盖首屏、输入、两次点击和 Page 身份，不包含 HMR 更新 |

关闭 layout 对照中的五个检查点分别覆盖初始浅色、切换暗色、修改模板后保持暗色、切回浅色验证新背景、再次切换暗色。所有原运行时断言实际执行，没有增加等待、强制 apply 或重采到绿。

原生源码项目保留默认 layout 的 `<view><slot /></view>`、owner 属性、`Component({})`、`styleIsolation: apply-shared`，以及 glass-easel / requiredComponents 配置。它没有 Vite/Rolldown 产物和 stateful 客户端；真实 IDE 可以显示 slot 内容并保持交互。这证明宿主具备该基本能力，但不能据此证明生成产物与原生输入完全等价。

## 范围与下一步

当前证据使 stateful 产物中默认 layout 的初始化链成为优先调查方向。去掉 layout 同时改变模板包装和依赖图，尚不能定位为单个注册、生命周期或宿主缓存缺陷。不能通过关闭 layout、改用 classic 或遗漏子组件来替代用户所需行为。

临时 owner 属性对照的实现省略了原生 layout 的全部 props；本 fixture 没有显式 props，所以实际差异仅为 owner 属性。该实现只用于诊断，没有保留在产品中。编译源码已恢复并重新构建，正式 suite 已恢复；原生临时测试源码只作为证据保存，没有加入正式清单或弱化已有场景。

## 证据与验证

[完整脱敏归档](./issue1082-tdesign-layout-isolation.json.gz)包含十项运行的完整日志/DOM、临时差异、产物摘录、原生复现源码、编译对照及恢复构建日志。解压 1165388 字节，SHA256：`e0a22b49c6cc0c9bb3d770e23d67f3005c5a0285d79f535b36ee06a464ceb10e`。

更正后的关闭 layout 产物在额外 hash 读取前已被 suite 清理；其两项产物断言先于 IDE 启动执行且通过。其余可用产物摘录和原件 hash 保留，不补造缺失记录。gzip/隐私扫描、源码恢复与文档检查完成；所有本轮 E2E/dev 句柄终结。

本轮仅提交 `docs` 证据，无产品源码变化，不需要 changeset 或 create-weapp-vite 联动。原完整 TDesign 与 Wevu 验收仍未完成，PR #1086 保持草稿。
