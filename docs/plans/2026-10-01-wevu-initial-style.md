# Wevu 原生首次样式绑定

真实公共 CLI 开发场景中，TDesign tag/button 的 String `style` 属性在首次创建时收到 null。编译输出已有 `__wv_style_*` computed 与 binding manifest，但初始化占位数据仍只读取旧 `setData.pick`；没有显式 `data` 的 setup 组件还会提前返回，导致原生绑定早于 setup 的首次响应式同步。

修复把已验证的 binding manifest 传入现有原生初值阶段，与旧 pick 合并候选字段；仅补充编译器生成的顶层样式、类名及绑定占位值。保留显式数据、pick/omit 过滤和原有 computed 求值顺序，不提前执行 setup 或普通 getter，不制造嵌套键。没有新增公开类型/API，不改变 Vite/Rolldown 的产物写出所有权。

回归 fixture 位于 `e2e-apps/github-issues/fixtures/initial-style`。真实构建 Vue SFC 后先打开空白页，再订阅 console 并进入样式页，验证首次原生 String 属性绑定、真实组件点击事件、响应式更新和离开后重新进入。产物必须有两个页面的 JS/JSON/WXML 与组件映射。一个 suite 复用一个 automator，严格 DOM 检查点为 initial/updated/remounted；原生类型警告必须为零。清单同时登记严格 headless 和真实 IDE；mpcore 的 Node/browser 会话与浏览器 E2E 覆盖空字符串初值及后续样式属性更新。

验证记录（提交前工作树，基于主线 a282eb7d21fa4155915058d9c4687312c1992494）：

- 新增定义工厂回归先复现 2 失败；修复后工厂、初值、作用域插槽和 setData 调度共 64 项通过，加入 suite 清单后相关 5 文件 104 项通过。
- wevu typecheck、公开类型检查及构建通过，compiler/weapp-vite 在下游前重建；定向 ESLint 通过。新增中文 changeset 联动 wevu 与 create-weapp-vite。
- mpcore 原生属性 Node/browser 测试 3 项、实际浏览器 E2E 1 项通过。
- `WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/wevu-initial-style.runtime.test.ts`：1 case、3/3 DOM 检查点通过，零 runtime warning/error/exception。
- 对同一 suite 显式选用官方 Stable CLI、provider=devtools：1 case、3/3 DOM 检查点通过，实际 IDE 2.02.2608080、基础库 3.17.3，零 runtime warning/error/exception。启动 Tool.getInfo 超时及模拟器恢复日志保留，不称为无启动异常。
- 2026-10-01 01:29 UTC 核对官方下载页关联的 `https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json`，stable 为上述版本；这是本轮查询值，不是永久固定版本。只清理本任务持有会话；原手动项目监听进程保留。

早期 fixture 检查分别暴露跨组件 CSS 查询范围、序列化样式无末尾分号、切页根节点标记和原生元素定位问题，已经改用真实跨组件 XPath 与两页共有的根节点标记，保留失败日志，不弱化三个 DOM 断言。首次真实尝试还与不足一秒的清单单测重叠，未作为最终串行验收；最终真实运行独占 E2E，之后再串行执行浏览器和 headless 复验。

`define.ts` 既有文件超过 300 行，本次只传递已有清单，不改变其定义工厂边界；初始化逻辑仍收敛在独立的 `runtime/define/initialComputed.ts`，避免无关拆分。
