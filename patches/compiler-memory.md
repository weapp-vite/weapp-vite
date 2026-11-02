# 官方编译依赖的生命周期与资源验收

当前工作区使用官方 Vite `8.3.5` 和 Rolldown `1.2.16`，没有对应补丁文件、
`patchedDependencies` 登记或锁文件补丁绑定。Vite+ `1.4.0` 的 launcher/core 保持官方配对，
其内置 Vite 为 `8.3.5`、Rolldown 为 `1.2.15`，Vitest 配对为 `5.0.5`；
独立 Rolldown 与 Vite+ 内置引擎分别核对实际版本。
本说明不代表本轮产品验证、正式资源验收、跨平台矩阵或真实微信 IDE 验收已经通过。

## 交付范围

发布的 `weapp-vite` 继续加载外部官方 `vite` / `rolldown`。此前仅由工作区 pnpm 应用的补丁
不会自动传递给普通 npm 消费者，现已移除，不能再据此宣称独立安装获得了相同内存修复。

当前仍保留 Chokidar `6.0.0`、Vitest `5.0.5` 和 `@vitejs/plugin-vue` `6.0.10` 三份独立补丁。
其中 Chokidar 与 `readdirp` 由 `weapp-vite` 的 `alwaysBundle` 打入发布 JavaScript，消费者使用相同修补实现；
Vitest 与 Vue 插件补丁服务仓库测试及 Web 开发、构建，不会自动修改消费者安装的对应依赖。
各补丁用途与发布消费检查见[补丁说明](./README.md)。

没有替换平台原生二进制，也不手工改写应用构建产物。普通 npm 安装的消费者仍须独立确认实际
解析到的依赖、发布产物和监听实现，不能用工作区运行结果替代发布消费验证。

## 产品适配与内部观察

`weapp-vite` 为每代构建隔离自有插件钩子容器，关闭后释放自身持有的会话引用。
package imports 的 query/hash 兼容在产品插件内处理，保留精确映射、条件、自定义解析器和 external 语义。
这些适配约束产品自己的引用与解析路径，不改写第三方插件或上游私有缓存。

产品自有开发宿主通过公开 Chokidar API 接管监听，并保留显式使用 Vite 原生后端的配置路径。
启动和重启分别等待本代后端初扫或现存源码登记；关闭先解除登记屏障，再等待本代编译任务和资源释放。
独立 owner 关闭后不能撤销幸存 owner 或用户自己的监听。登记状态与实际保存交付是两项观察，
需要分别验证；`ready` 不能替代实际文件变化、产物更新及关闭证据。
显式要求 `followSymlinks:false`、glob 监听或原生 fs-events 后端的配置仍使用 Vite 原生 watcher；
不能把适配后端的通过结果用于证明这些回退路径的缺失输入登记问题已经解决。

原 Vite hooks、resolver 和 optimizer 诊断继续保留，包括元数据广播、动态输入、强弱引用、
受控扫描取消及缓存发布边界。原 Rolldown 诊断继续保留 options 身份、getter、关闭后引用和 GC 等断言。
这些诊断可能仍暴露官方依赖的内部行为差异；产品适配不等于这些问题已经由上游修复。
受控替身上的取消或回收结果，也不能写成真实原生异步取消已经验收。

## 公开产品门禁与已接受的例外

```sh
pnpm install --frozen-lockfile
pnpm --filter weapp-vite build
pnpm test:dependency-contracts
```

PR #1294 按用户授权引入两项临时验收例外：Web optimizer 关闭残留，以及连续构建的正式资源验收。
这两项没有修复，也不记录为通过。例外随默认门禁持续生效至显式移除，不因 PR 合并自动结束；
仅适用于固定官方 Vite `8.3.5` / Rolldown `1.2.16`，不自动扩展到 Vite+ 内置的 `1.2.15`。
更换依赖版本时，必需入口明确失败，必须重新评审或移除例外，不能沿用旧版本的接受记录。
其他 CI、coverage、产品断言、审查及真实 IDE 门禁不因此获得豁免。

`test:dependency-contracts` 通过正式入口取得机器级串行租约，依次运行 Vite 必需产品契约、
Rolldown 七项公开产品契约和现有 Chokidar 完整依赖契约。Vite 必需入口固定运行
`hooks`、`resolver`、`mini-optimizer`、`polling`、`ready` 五项，不接受调用者任意筛选或跳过参数。
适用的五项任一失败仍非零退出，不能通过继续忽略失败取得通过结果。

Vite 原六项完整产品清单保留为 `hooks`、`resolver`、`mini-optimizer`、`web-optimizer`、`polling`、`ready`，
由 `pnpm diagnose:vite-product-lifecycle` 执行；原 `product/run.mjs` 和产品断言保持不变：

- 通过真实构建观察自有钩子执行顺序、连续构建和运行结果，以及 package imports 的映射、条件与错误行为。
- 观察小程序模式的依赖发现设置，以及 Web 扫描关闭等待和缓存状态；这些观察不证明所有 native cancel 时序。
- 通过实际文件保存观察多个监听 owner、独立原生 listener、两种关闭顺序和幸存者交付。
- 观察缺失 env/public 目录下的首次保存，以及重启后立即保存、新 owner 登记与旧 owner 停止回调。

当前官方 Vite `8.3.5` 的 Web scanner 关闭仍有真实失败：扫描尚在执行时请求关闭，
扫描结束后会留下新建的 `deps_temp_*` 缓存。立即关闭和先等待公开 requests idle 再关闭均保留
严格的缓存清空断言；完整产品诊断失败仍非零退出。命令名中的 `diagnose` 只表示验收职责调整，
没有把该公开产品缺陷重新分类为内部实现差异，也不能以额外调用一次 `close()` 宣称修复。
必需五项通过不表示原六项完整产品契约通过。

Rolldown 的七项清单固定为 `generate-write`、`close`、`errors`、`inflight-error`、`repeat-build`、`watch`、`scan`：
验证 generate/write 产物和运行结果、公开 output 选项、关闭等待、错误及后续回调、重复构建、
实际 watch 编辑后 42 → 43 的产物变化，以及 scan 与关闭钩子。产品门禁不要求内部 options 对象身份或 GC 形态。

两份产品报告分别保存到 `.tmp/dependency-contracts/vite.json` 和 `.tmp/dependency-contracts/rolldown.json`，
使用 `suite: product-lifecycle`，记录 `planned`、实际成功的 `completed` 前缀和逐项观察。
Vite 必需报告的 `planned` / `completed` 仅含五项，同时保留六项 `fullInventory`、明确的 `waived`
条目及含 `web-optimizer` 的 `notExecuted`；适用项通过后标为 `assessment: accepted-with-waivers`，
不能将被豁免项填入成功清单或称为原六项完整通过。
缺项、重复、乱序、失败或空观察不能被记为完整通过；后续失败保留此前已完成的结果。
关闭或超时不明时必须保留资源归属与现场，不能与其他 E2E 重叠。

CI 的 Linux、Windows 和 macOS 构建矩阵仍须运行适用入口并保存报告。
当前机器上的单次通过不能代替跨平台、发布消费或被豁免的正式资源验收；验证只记录实际状态。

当前候选的普通 npm tarball 消费验证已覆盖 `wv`、Vite 和 Vite+ 三条宿主：主包、独立分包、worker、
imports 精确 query、源码更新、配置重启、headless 页面及 Web 构建均通过，所用官方编译依赖已逐文件核对无补丁。
该结果不证明 Web optimizer 关闭或正式资源验收通过。

## 未修复问题对消费者的影响

Web 开发服务器在依赖扫描尚未结束时关闭或重启，可能留下 `deps_temp_*` 临时缓存目录。
现有立即关闭及公开 requests-idle 后关闭两条路径都已复现；这证明关闭后的缓存清理存在缺口，
不能由残留目录单独推断产物错误，也尚未证明所有扫描尾任务都已终结。Web 构建和普通更新的通过
不覆盖这两个取消时序；该风险会随消费者使用官方 Vite 存在，不是仅限工作区的本地问题。

同一 Node 进程连续构建或长期开发更新时，编译器旧代引用保留可能增加进程内存。
完成屏障和冻结依赖生效后的 classic 实测为 512 个 SFC、14 次编辑，15 组增量/fresh/runtime 对照均通过，
但 RSS 增长 `233.938 MiB`、强制 GC 后 heap 增长 `37.009 MiB`，超过原 `32/16 MiB` 门限。
仅含官方 Vite `8.3.5` / Rolldown `1.2.16` 的独立关闭/GC 复现也保留了全部 16 代观测引用。
这些结果支持编译器释放链仍有问题，不能证明全部增长属于同一原因、后续按相同速率线性增长，
也不证明小程序页面 runtime 本身存在同样增长。

Vite+ `1.4.0` 内置 Vite `8.3.5` / Rolldown `1.2.15` 的 tarball 构建、更新、重启和 headless 消费已通过，
但没有完成同一正式资源矩阵，不能把独立 Rolldown `1.2.16` 的数值或豁免适用性外推到它。
普通一次构建成功、关闭后直属 worker 为零，以及上述消费结果均不等于所有 native 引用已释放。

局部真实 DevTools 消费验证使用已安装 Stable `2.02.2608080`、基础库 `3.17.2`，不宣称为官方最新版本。
主包和独立分包的两个 DOM 检查点都捕获到预期内容，但宿主产生五条 `webapi_getwxaasyncsecinfo:fail`
错误，严格日志断言失败；关窗也未取得完整原生销毁证据。本次验收仍为失败，后续仅通过正常退出安装和
领域恢复终结本任务资源，保留原错误与关窗证据，没有通过重跑、忽略日志或补造销毁事件改变结果。

## 独立内部诊断

```sh
pnpm diagnose:dependency-internals
```

该入口在独立 Node 进程中使用 `--expose-gc`，运行原 Vite 函数提取与 watcher 诊断，以及原 Rolldown
真实 build/watch、options 身份和引用释放诊断。提取失败、内部断言失败或清理失败仍非零退出，
不静默跳过、不以在线下载另一份依赖替代当前安装，也不将产品通过改写为诊断通过。

诊断报告使用 `suite: dependency-internals`，完整入口不接受筛选。底层 `vite/run.mjs` 的显式 `--case`
筛选只表示所选诊断完成，必须保留完整计划、所选清单和实际完成项；不能由该结果推断全部诊断通过。Rolldown 报告保存在
`.tmp/dependency-diagnostics/rolldown.json`。内部诊断与产品门禁的结果分别记录，失败证据继续保留。

原六项公开产品契约另用 `pnpm diagnose:vite-product-lifecycle` 执行，报告其实际完成、失败和未执行项。
它与上述内部诊断分别报告；任何原始断言失败仍非零退出，不以吞错或 `continue-on-error` 取得成功。

## 正式资源验收

正式资源验收继续使用 `scripts/editSequence` 和 `compiler-resource-acceptance.yml` 的原门限：

- 512 个 SFC，至少 14 轮编辑，每轮保留产物与 headless runtime 对比。
- 排除 3 轮预热后使用 4 个样本的窗口；进程 RSS 和进程树 RSS 增长限额为 32 MiB，heap 为 16 MiB。
- 进程、watcher、engine、转换调用、输出文件、活动资源和监听器数量的增长限额为 0。
- GC 耗时和次数仍分别使用 50 ms、2 次的增长限额；缺少必要观测或趋势未知均不能通过。
- 两组 profiling off/on 按 off/on/on/off 串行执行；默认开销预算为 5%，不放宽正式 workflow 的配置。

用户已接受将该项从当前候选的发布必需验收中豁免，手动资源 workflow、原始失败断言和以上门限保持不变。
已完成的 classic 首轮仍为失败，完整 off/on/on/off、stateful 及完整资源矩阵尚未通过；
不得把未执行部分写成通过，也不得用例外声称内存增长已修复。退出例外前须在重新评审的依赖组合上，
完成原资源矩阵并满足原门限；仅提高版本或补跑一次局部场景不足以解除这一边界。

函数级 WeakRef 回收或一次诊断内存下降不能替代这些门限。真实微信开发者工具及其宿主内存验收
仍按 IDE 套件执行，不能用 headless 资源报告替代。

## 后续升级

升级前核对官方依赖及 Vite+ 配对版本、实际解析入口和锁文件，重建受影响包后依次执行公开产品门禁、
独立内部诊断、发布消费验证和必要的跨平台及正式资源验收。内部诊断与产品行为不一致时，先保留双方证据，
不能仅因版本号提高、一次构建通过或产品适配生效，就宣称上游内存和原生生命周期问题全部解决。

后续若移除 Chokidar 等剩余补丁，仍须确认上游正式版本覆盖原行为契约，并完成跨平台与发布产物回归，
同步核对打包策略和第三方软件声明。不得为了通过当前官方版本而弱化既有内部诊断断言。
