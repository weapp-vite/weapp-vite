# 全仓回归中发现的问题

本轮排除 `uview-plus-compat`、`wot-ui-compat` 专项，采用正式 classic 范围。实验性 stateful HMR 沿用既定范围外策略。

## 同步随机数契约

真实微信 IDE exhaustive 在 GitHub issues 聚合任务发现 issue #448 的 UUID 唯一性失败。该任务的 69 个 case 中 68 个通过，严格 DOM 捕获 178/179 个 checkpoint；正式任务因失败停止，未执行部分不计通过。

`@wevu/web-apis` 原实现将小程序宿主的 `getRandomValues` 当作 Web Crypto 同步接口使用。微信接口实际接收 options 并异步返回 ArrayBuffer，不会同步修改传入的 TypedArray。调用不抛异常就记录填充成功，会让零初始化数组生成重复 UUID。旧单测使用同步填充数组的宿主 mock，遗漏了这一边界。

修复移除同名异步宿主接口分支，保留原生同步 Web Crypto 优先级与现有 Math.random fallback；后者不提供密码学安全保证。最小回归在旧实现下确认数组没有更新，修复后检查原数组身份、内容及宿主接口未被调用。现有真实 IDE UUID 断言保持不变。

simulator 增加使用实际兼容层构建产物的集成与浏览器回归，通过 session 内的异步宿主 mock 复现契约边界，并检查两次 reLaunch 的 UUID 格式、唯一性和渲染文本。这是兼容层在模拟宿主中的回归，未声称补齐 simulator 的原生随机数 API。未更改公开类型。

## Windows CLI loader URL

CI E2E 的 Windows / Node 24 miniapp shard 2 在进入 CLI 构建前失败。Node `--import` 收到磁盘绝对路径，将盘符解析成 URL scheme，报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`。现使用 `pathToFileURL()` 转换 tsx loader，保留 SIGTERM/disconnect 的真实子进程清理和退出码断言。

## 验证与文件组织

- 定向兼容层和 simulator 集成：74 项测试通过。
- web-apis 全包 25 文件、269 测试通过，四项覆盖率均为 100%；源码 typecheck、公开类型、构建及 simulator typecheck 通过。
- CLI 生命周期 9 项用例、simulator Chromium 回归通过；Web API 4 项用例在 headless 与真实 IDE 均通过，保留原 UUID 与严格 DOM 断言。
- 真实 IDE 为 Stable `2.02.2609250`，基础库 `3.17.2`；官方查询 `2026-11-10T17:18:32Z` 确认所选版本匹配，实际连接身份一致，同一 suite 复用 automator 并通过 reLaunch 切页。task 完成后正常退出所认领安装，登录态保留。
- 全量 suite 与远端矩阵继续执行；以上定向结果不替代最终正式验收，最终结果由任务状态索引和正式报告记录。
- 大型既有 runtime 测试仅调整相关契约段；新 simulator fixture 与用例各自独立成文件。拆分既有测试不属于此次根因修复，避免影响全量 case 收集。
