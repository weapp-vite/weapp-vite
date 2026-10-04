# 原生 WXSS 首次保存：缓存处理顺序审计

状态：**已确认热编译早于缓存失效处理；旧内容缓存复用仍为推断。** 本记录不构成 #1015、#1065、#1081 的完成验收。

## 真实观察

纯原生小程序仅使用 class 选择器，没有 weapp-vite、automator 或注入 bridge。连接宿主为官方 Stable 2.02.2608080，页面显示 SDK 3.17.3。官方渠道记录来自 `https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json`，其稳定版发布日期为 2026-09-30；本轮资源记录建立于 2026-10-04T15:47:52Z，独立的官方下载查询时刻未归档。本文不将 SDK 3.17.3 称为已核实的稳定基础库。

页面 `pages/style-probe/index` 在计数为 2、输入为 `native-held` 时，仅保存一次 WXSS，将 `.probe` 从红色改成蓝色。磁盘文件与记录的蓝色 SHA-256 完全匹配；把该颜色单独反转回红色后，SHA-256 也与保存前记录匹配。操作方记录确认保存后没有第二次保存、编译、刷新或 reLaunch。

最终观察为 2026-10-04T15:57:27.855Z，距保存约 117.15 秒，画面仍红。前、后、最终三份 AX 中页面、计数、输入、App/Page 标识均一致；颜色结论来自已检查的画面，非 AX 颜色推断。下方图片只保留模拟器，已裁去头像、项目路径和宿主界面。

| 阶段 | 画面 |
| --- | --- |
| 保存前 | [模拟器截图](native-wxss-before.png) |
| 保存后 | [模拟器截图](native-wxss-after.png) |
| 最终观察 | [模拟器截图](native-wxss-final.png) |

## 同一次保存的后台顺序

后置日志完整保留前置日志的 447 行前缀，新增 13 行全部属于同一 runtime/window（`rt:7, win:s65`）。启动时已执行外层 WXSS 和内层 WXSS 文件内容缓存，原因均为 `missing`。

| 时间（UTC+08:00） | 事件 |
| --- | --- |
| 23:55:30.705305 | 操作方记录的单次保存 |
| 23:55:30.818 | `transWXSSToJS` |
| 23:55:30.818 | `miniProgramWxss` 执行，`reason: force` |
| 23:55:31.215 | `flush coalesced weapp file changes 1` |
| 23:55:31.217 | `compile onFileChange change pages/style-probe/index.wxss` |

外层强制编译比合并处理早 **397 ms**，比对应文件变更处理早 **399 ms**。新增日志没有 `miniProgramWxssFilesForTrans` executor。此处观察到的是“没有执行该缓存的生成函数日志”，不能把它写成“直接看到了旧缓存值”。

## 与静态实现的对应关系

只读核对了已安装宿主 ASAR 中的 18 个资源、20 个既有片段，资源 hash、片段 hash 和字符偏移全部一致，未修改安装。

两条通知链共用同一 `projectFileUtils`。UI 收到 `contentChange` 后立即进入 `triggerBuild → updateAppCode → transWXSSToJS`；后台缓存对文件变更做 400 ms 合并后才失效。外层 `miniProgramWxss` 明确支持 hotReload force，但其调用的 `getWxssFilesAndContentCached` / `miniProgramWxssFilesForTrans` 没有同样的 force。内层缓存包含 WXSS 实际源码映射，随后作为 `replaceContent` 交给编译器。

本轮日志补上了原候选机制缺少的真实先后顺序，支持“外层强制编译仍可读到尚未失效的内层缓存”的解释。**未直接读取内层 content、返回的编译样式或 runtime 接收到的样式载荷，因此不能证明其具体值仍红，也不能排除样式应用阶段另有缺陷。**

操作方曾用原生命令面板查找 `inspectApp`，并检查帮助/工具菜单，未找到可用入口；未创建 inspector。这是操作记录，没有单独归档的菜单截图，不作为内部缓存值证据。

## 收尾与交付边界

使用同一所选 CLI 的 `close --project <owned-native-fixture>` 关闭了本轮项目，退出码为 0，项目端口拒绝连接；后置 AX 与资源登记记录了共享宿主和原有其他项目仍保留。原生 fixture 目录保留用于证据复核。

审计阶段仅复核前述 Computer Use 采集的资料，没有重新运行测试、构建或性能采样，也没有修改产品代码。不能用延迟写文件、第二次保存、清缓存、移动 fixture 或降低首次保存断言来代替修复。原始 AX、日志与资源记录可能含本机信息，仅保存其摘要和必要提取内容；公开交付应使用本报告、JSON 和模拟器裁剪图，不直接上传原始捕获文件。

完整日志行号、文件摘要、安装源码定位与证据边界见 [结构化审计](native-wxss-cache-ordering.json)。
