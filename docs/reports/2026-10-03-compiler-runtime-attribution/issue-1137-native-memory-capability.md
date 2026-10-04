# #1137：原生 AppService 内存能力探针

状态：**已观察到原生 Memory 面板读数和目标 AppService 的 `performance.memory` 数值；尚未取得原生 `Runtime.getHeapUsage` 协议响应，内存验收仍未完成。** 这是一轮独立能力探针，不是冻结性能样本的补采。

## 环境和输入身份

官方版本记录于 2026-10-04T16:29:20.725869Z 查询[微信开发者工具版本配置](https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json)，稳定渠道为 2.02.2608080，发布日期为 2026-09-30。两张归档截图的窗口标题均显示 Stable 2.02.2608080。操作记录中的实际基础库为 3.17.3；这不是基础库稳定渠道证明，现有截图和 AX diff 也没有独立显示该版本。

离线逐文件核对了探针项目的 22 个应用产物，共 212,040 字节；文件清单、字节数和 SHA-256 与冻结 `published-stable-20261004-03` 的 normal 产物完全一致。该清单不包含独立的 IDE 项目配置文件，不把“应用产物一致”扩张为全部 IDE 配置一致。原始冻结报告的 SHA-256 也保持不变。

## 已归档的观察

| 观察面 | 独立归档可确认的结果 | 边界 |
| --- | --- | --- |
| 原生 Memory 面板 | AX diff 中被选中的 VM 行显示 **30.2 MB**，附有 `increasing by 2.4 kB per second`；该行本地来源与 Console 地址的来源一致 | 只是界面显示值和界面瞬时速率，不能推断持续增长或泄漏 |
| 面板汇总 | `Total JS heap size` 同样显示 30.2 MB | 未用汇总值替代目标 VM 读数；相同的四舍五入结果不能证明只有一个 VM |
| AppService Console | 截图的只读表达式返回 AppService `mainframe` 地址、`pages/index/index` 路由，以及 `usedJSHeapSize: 52304782`、`totalJSHeapSize: 54255190` | 单位为字节，数值满足非负且 used 不大于 total；它们来自 `performance.memory`，不是 `Runtime.getHeapUsage` 响应 |

操作方另记录了 30.1–30.6 MB 的范围及单 VM。当前归档 AX 只含增量变化，能独立复核的值为 30.2 MB；不把完整范围和 VM 数量写成独立归档结论。`memory.png` 仅显示 Memory 标签和 profiling type 控件，数值行位于截图可见范围之外，不能用该图片证明读数。

Console 截图能直接区分目标 AppService 主框架与页面渲染框架，也返回了冻结基准首页路由。但尚未保存原生协议的 target id、isolate id 或响应时间戳；Console 上下文身份也不能证明堆只包含业务代码。公开报告将机器端口和会话标识改为路径占位符，原始证据保留摘要供本地复核。

## 两种读数不作替换

Memory 与 Console 在不同时间读取，测量口径也未证明相同。本报告不计算二者差值、不推导等价关系，也不把 `performance.memory` 字段改名为正式采集器的 `usedSize` / `totalSize`。打开调试面板和执行诊断表达式本身也可能影响被观察进程。

本轮证明目标 AppService 中存在可读的数值型堆观察，不能再由 automator 的不支持结果推导“整个 Stable 宿主完全无法观察堆”。原生 `Runtime.getHeapUsage` 是否能够提供身份明确的原始结果、是否存在可供正式采集器使用的稳定外部入口，仍未验证。

## 实验开关与收尾

操作记录显示 Protocol Monitor 实验开关初始为关闭，未修改设置，临时启用请求在本轮关闭时仍待授权。归档 `protocol-setting.ax.txt` 只包含 Experiments 页签焦点，不含 checkbox 值，因此开关状态标为操作方记录。

资源记录显示本次项目通过所选 CLI 精确关闭，退出码为 0，项目端点关闭，共享宿主和共享代理仍保留，清理错误为 0。离线审计没有重新连接端口或检查窗口，不把登记结果写成新的现场验证。原始截图包含无关宿主界面和头像，本稿不直接公开图片；结构化报告保存原始文件摘要，并明确记载截图未展示的数值区域。

## 对冻结验收的影响

原有 normal/performance **30 + 30** 个样本和 **96** 次 automator `protocol-unimplemented` 探针保持原样。本轮没有回填、重命名或替代历史样本，没有把 worker RSS 用作 AppService 堆。首屏及导航 `firstCommitMs`、`visibleMs` 的缺失状态也不因此改变，#1137 不满足完成标记条件。

后续若获准临时开启 Protocol Monitor，应先保存完整 AX 和原值，再记录与目标 AppService 绑定的 Memory 轮询协议请求、原始 `usedSize` / `totalSize` 或实际错误，以及 target/isolate 和时间戳；结束后恢复原值并关闭所持有的项目。即使取得成功响应，也先登记为独立能力结果，不回填冻结的性能运行。

完整字段、22 个产物摘要与原始证据摘要见 [结构化审计](issue-1137-native-memory-capability.json)。本审计仅离线读取证据，没有运行 UI、E2E、构建、测试或性能采样。
