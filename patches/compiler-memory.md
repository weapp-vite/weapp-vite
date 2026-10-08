# 构建依赖的引用生命周期补丁

本轮候选针对 Vite `8.3.4` 和 Rolldown `1.2.13`。补丁由工作区的
`patchedDependencies` 登记，并随 `pnpm install --frozen-lockfile` 应用。
本说明不代表正式资源验收、跨平台矩阵或真实微信 IDE 验收已经通过。

## 适用范围

补丁只影响使用本仓库工作区配置和锁文件安装的依赖。发布的 `weapp-vite` 产物仍然从外部
`vite` / `rolldown` 包加载相关实现，工作区的 pnpm 补丁不会自动传递给 npm 消费者。
独立应用安装已发布的 `weapp-vite` 时，不能据此宣称同样获得了内存修复。

候选使用 JS 补丁，没有替换平台原生二进制，也没有手工改写应用构建产物。
后续若通过上游版本或其他分发方式交付给外部用户，仍需独立安装消费端并验证实际解析到的实现。

## 修复的引用链

Vite 的原始 hook 元数据缓存通过包装器数组强持有历次构建环境。补丁将包装器登记改为弱引用，
单独保存元数据描述符，保持原始 `filter` / `order` 广播顺序、只读写入错误和重入追加行为。
用户显式将首个包装器的元数据改为访问器时，补丁保留该接收对象，以维持 `this.handler`
等动态行为；全部访问器移除或恢复为数据属性后解除这项保留。

Vite 传给原生 resolver 的回调原本与环境工厂共享闭包，额外捕获 `partialEnv` / `getEnv`。
补丁通过顶层工厂创建 imports、警告和 debug 回调。imports 回调仍在每次调用时展开原 options，
并读取当次的 `resolveOptions.isRequire`；没有丢弃后续回调或将输入提前冻结。
`getEnv` 的开发模式生命周期保持原实现，需要独立验证其行为。

Vite 开发依赖扫描的取消原本仍会派生优化任务，关闭时并发读取的 `optimizationResult`
可能尚未建立，导致 `close()` 返回后留下新的缓存目录。补丁先终结初始化和扫描，
阻止关闭阶段派生新写入，并等待已开始的优化、原生取消和缓存发布。发布中的任务不会
因引用已从 `optimizationResult` 移走而失去归属；重复关闭复用同一个结果。

Rolldown 的 normalized options 包装器可经由插件闭包回到保存原生回调的 options。
补丁保存同一次原生调用的纯 JS 数据，保持输入和输出包装器的缓存及 getter 行为，
避免由该包装器长期持有原生 options。原生回调执行、失败传播和关闭顺序仍须符合原契约。

## 验证入口与边界

```sh
pnpm install --frozen-lockfile
pnpm vitest run scripts/dependencyContracts/vite.test.ts
pnpm test:dependency-contracts
```

Vite 契约读取当前安装包，在独立 Node 子进程中按严格模式执行所提取的函数。
它验证元数据读写、广播中止、重入、弱引用回收、访问器接收对象、imports 条件、动态输入和日志参数。
优化器覆盖初始化未完成、扫描取消、缓存发布与遍历等待原生构建四个受控关闭边界，并用真实 Vite
middleware server 暂停原生依赖扫描，确认关闭会等待扫描且不留下取消后新建的缓存；原生取消期间的回归同时确认 writer 终结前不清理缓存。
源码提取失败会直接失败，不静默跳过，也不在线下载另一份依赖作为测试前提。
包元数据查找和原生插件构造在此处是受控边界；它不等同于真实 N-API、开发服务器或 watch 验证。

`test:dependency-contracts` 取得机器级串行租约，在独立 Node 进程中依次运行 Vite 函数契约和
Rolldown 真实 build / watch 契约。后者固定覆盖八组场景：不同 output、缓存与 getter、重复关闭、
失败后复用、失败时的后续回调、关闭后的引用释放、watch 重建与 scan。watch 必须实际执行
42 → 43 的产物变化，关闭后的 input/output options 和日志 owner 必须释放；关闭或超时不明时
保留租约与现场，不能与其他 E2E 重叠。报告保存到 `.tmp/dependency-contracts/rolldown.json`，
CI 的 Linux、Windows 和 macOS 构建矩阵运行同一入口并上传报告。

开发模式依赖优化、真实 resolver 的 package imports 和共享插件跨环境元数据更新，仍需真实
Vite 集成验证，不能只依据上述函数级测试判断通过。

正式资源验收继续使用 `scripts/editSequence` 和 `compiler-resource-acceptance.yml` 的原门限：

- 512 个 SFC，至少 14 轮编辑，每轮保留产物与 headless runtime 对比。
- 排除 3 轮预热后使用 4 个样本的窗口；进程 RSS 和进程树 RSS 增长限额为 32 MiB，heap 为 16 MiB。
- 进程、watcher、engine、转换调用、输出文件、活动资源和监听器数量的增长限额为 0。
- GC 耗时和次数仍分别使用 50 ms、2 次的增长限额；缺少必要观测或趋势未知均不能通过。
- 两组 profiling off/on 按 off/on/on/off 串行执行；默认开销预算为 5%，不放宽正式 workflow 的配置。

函数级 WeakRef 回收或一次诊断内存下降不能替代这些门限。真实微信开发者工具及其宿主内存验收
仍按 IDE 套件执行，不能用 headless 资源报告替代。

## 升级与移除

依赖升级前检查上游对应实现和实际安装后的补丁应用结果。Vite `8.3.4`、Rolldown `1.2.13`
的发布包已做只读源码比较，仍有本轮涉及的引用结构；这项比较不是新版运行验收。

当上游正式修复后，在同一候选提交中移除对应补丁登记并由 pnpm 更新锁文件，再运行固定契约、
真实 build/watch、必要的跨平台检查和原资源门禁。不能仅因版本号提高、补丁冲突或某次构建通过
就移除保护；也不能更新提取边界后顺手放宽行为断言。测试文件按 hook 行为、引用生命周期和 resolver
拆分，保持单文件小于 300 行；第三方发布 bundle 的结构由依赖维护。
