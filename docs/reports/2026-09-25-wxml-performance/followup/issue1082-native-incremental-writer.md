# Issue #1082：已编译增量资产直接使用原生 writer

在 `4c6904f352cd827173c4067187a125ea55331398` 上，stateful 每次发布已经编译完成的 JS/WXML/WXSS，仍创建一次完整 Vite build 配置。虚拟入口仅用于发射准备好的资产，重复的配置解析不参与业务编译。

改动前的局部对照使用相同的两份准备好资产，预热一次后固定交替顺序执行十次持久化并逐次校验字节。Vite 路径约 5.9–6.9ms，直接 Rolldown write 约 0.9–1.3ms。这是写出步骤诊断，不是整段 HMR 或三 OS 性能门禁；归档脚本引用改动前源码，重放该对照应使用上述 base HEAD。

## 实现与边界

首轮带 public 复制选项的发布仍由 Vite 执行，保留已解析 publicDir/copyPublicDir 语义。后续已编译输出使用 Rolldown 的虚拟入口和 emitFile，经原生 write 持久化，并在 finally 关闭构建句柄。

两条路径共用 writer plugin：脚本作为最终字节发射，文件名分隔符规范化，虚拟入口 chunk 不落盘，成功写出后只撤销自有失效资产。没有手写 bundle、额外 touch、改变轮询或调低验收阈值。

新增回归验证预编译脚本中的 require 不被重新解析、二进制字节完全保留且没有虚拟入口残留。原 public 首轮复制/禁用/碰撞优先级、部分输出保留、删除与路径边界断言全部保留。

## 验证

- writer/prune 两文件 15 项通过；weapp-vite typecheck、public types、scoped lint、重建 dist 通过。
- classic/stateful 资产 CLI 六项通过，18.67 秒。
- 完整 headless 门禁六场景 37/37 DOM，22.72 秒，包含模板派生计算/事件及三类模板往返。
- 真实 DevTools 四场景 26/26 DOM，68.92 秒：原生样式/脚本、资产、编辑器文件、Wevu 子组件脚本更新与恢复。
- runtime 前后全机进程检查未见其他 E2E；没有修改测试断言或复制手工产物。

这些结果只证明写出边界的正确性和可避免开销。正在执行的 Nightly `36290038049` 冻结旧 42a，不包含本修正；已核验的 stateful Wevu 模板重复编辑仍为 +5.0006% / +6.8532% 确认回退，不能改判通过。原真实首次模板及 TDesign 启动问题也未被本页结果消除，PR 保持草稿。

[脱敏归档](./issue1082-native-incremental-writer.json.gz) 解压 326320 字节，SHA256 `c325bee57f3127a63bcfcd44d7b9bdaa1f2e9bb3b9b33e2fafae9117cd37c365`。包含局部对照脚本/数据、单测/构建/类型日志、CLI 和两 provider 完整 DOM、源码 hash。包含 weapp-vite/create-weapp-vite 中文 patch changeset。
