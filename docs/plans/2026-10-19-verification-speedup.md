# 验证提速实施与验收

本轮覆盖本地验证、GitHub CI 和真实微信 IDE。目标是在相同框架输入、场景、系统、Node 与缓存策略下，将执行关键路径的三轮中位数降低至少 30%。审批、调度等待、实际执行和 runner 分钟分别记录；历史报告和离线分片估计不作为本轮实测结果。

## 执行入口

```sh
pnpm verify:plan --base origin/main
pnpm verify --base origin/main --mode quick
pnpm verify --base origin/main --mode review
pnpm verify --mode full
```

计划入口只读计算验证范围。quick 提供定向反馈，review 增加类型契约、消费者与相关 runtime，full 复用正式全量入口。报告明确保留剩余验收，局部通过不能代替完整通过。

影响范围覆盖完整 workspace、四类本地依赖、Turbo 显式依赖与跨目录输入。暂存、未暂存、未跟踪、删除和重命名均参与计算。全局配置、lockfile、未知输入或无法取得可信基线时保守扩大范围；执行前核对计划输入指纹。

## 四批交付

1. 基础契约：统一计划、报告、阶段计时和产物身份；先以 shadow 方式观察范围选择。
2. CI 编排：各系统构建后独立消费、四份 coverage 原生合并、短 consumer 聚合、历史耗时分片和严格聚合。
3. 本地优化：范围选择、构建与类型契约去重、经过审计的纯任务缓存、fixture 隔离和 setup 拆分。
4. IDE 与验收：同 fixture 共享会话、可观察条件等待、资源接口及同范围性能对比。

源产物写出仍由正式构建器完成；下游验证保持 dist 同步要求。纯任务缓存与非隔离测试分开，coverage 始终实际执行完整测试集合。测试分区以文件集合等价检查防止遗漏或重复。

## CI 与分片契约

每轮审批只绑定同一冻结 revision。各 OS/Node 的消费者仅等待自身产物，保留 injected workspace 链接刷新。产物必须核对提交、工具链、lockfile、构建范围与文件内容。

历史耗时按系统、Node、provider、平台和 runner 类型隔离，只使用可信主线完整成功报告。分片计划一次生成并冻结，所有执行者使用同一摘要。单 shard 成功仍为部分覆盖，只有聚合器校验全部任务、case、checkpoint 与身份后才可记录完整通过。

缺失、重复、额外结果、错误身份、失败、取消、blocked 或未执行不得产生完整通过。coverage 使用 Vitest 原生 blob 合并，合并后执行既有阈值，不能直接拼接 lcov。

## 资源和回归

首轮只使用本机与 GitHub 托管 runner，不接入远端或新增付费资源。本机 CPU 默认预算为可用核数的 50%；同机同用户 E2E、headless、HMR 与真实 IDE 保持互斥，由一个负责人统一调度。

同 fixture 的 IDE 场景共享一个受管 session，通过原有导航语义切换，每个 case 核对初始状态并隔离 collector。冷启动、首屏、HMR、退出和并发会话专项继续独立。计时包含预检、构建、启动、连接、页面就绪、执行和清理，不缩减超时以制造提速。

每批运行范围 ESLint、workflow 检查和相关契约测试。runtime 先重建产物、执行 headless，再串行验证真实 IDE；正式完整 IDE 在合并后、与 origin/main 一致的干净 main 工作树执行。环境阻塞与未执行明确记录，不能计为通过。

新增辅助模块按职责拆分，尽量保持单文件少于 300 行；对现有大型 runner 的修改保留生命周期边界，通过独立 helper 承担计划、计时和聚合职责。本轮纯内部验证维护不添加 changeset；若实施中涉及发布包可观察行为，则单独补充回归和 changeset。

## 当前证据

基础契约以默认 shadow 策略交付。隔离后续批次后，本地新增契约 15 个文件、86 项测试通过；现有 PR Actions 37 个文件、443 项测试通过；E2E 内部工具 6 个文件、140 项测试通过。范围 ESLint、actionlint 和实际计划 JSON 生成通过。

CI 运行、真实 IDE 验收及三轮性能对比仍需补入对应提交和结果。在这些证据完成前，本记录不宣称已达成 30% 提速或完整验收。
