# E2E Warning/Error 归类报告（2026-02-23）

## 1. 输入与范围

- 主日志：`/tmp/e2e-latest.log`
- 本轮目标：
  1. 对 e2e warning/error 做整体归类。
  2. 修复 runtime warning/error 统计中的误报（环境启动失败被当成 runtime error）。

## 2. 归类口径

- `Build Warning/Error`：构建阶段控制台中 `[warn]` / `[error]`。
- `Runtime Warning/Error`：小程序运行期 console/exception 事件。
- `Infra Error`：环境/工具链问题（如 DevTools 启动失败、文件监听上限），不归为业务 runtime 错误。

## 3. 归类结果（修复前，基于 /tmp/e2e-latest.log）

### 3.1 总量

- `console_warn=13`
- `console_error=35`
- `e2e-build-stats=16`
- `e2e-runtime-stats=34`

### 3.2 明细

1. Build Warning（13）

- 12 次：`[warn] [vue] 检测到项目中有 .vue 文件，但未安装 wevu...`
- 1 次：`[warn] [分包] 模块 pages/coupon/common.js 同时被主包引用...`

2. Runtime Error（34）

- 34 次：`[error] [runtime:launch] listen EPERM: operation not permitted 0.0.0.0`
- 结论：该类错误属于 DevTools/端口权限环境问题，不是业务运行时逻辑错误。

3. Infra Build Error（1）

- 1 次：`[error] [监听] 文件监听数量达到上限 (EMFILE)`
- 伴随：`unable to start FSEvent stream`

## 4. 根因结论

- 运行时 error 的主量来自「IDE 自动化启动失败（EPERM）」；旧逻辑将其计入 runtime error，导致统计口径污染。
- 实际业务 runtime warning/error 未被有效观测到（启动即失败）。

## 5. 已实施修复

### 5.1 修复点

文件：`e2e/utils/automator.ts`

- 新增 DevTools 基础设施错误识别规则：
  - `listen EPERM`
  - `operation not permitted 0.0.0.0`
  - `EACCES`
  - `ECONNREFUSED`
- `launchAutomator` 启动失败时：
  - 若属于 infra 错误，输出：
    - `[e2e-runtime-stats] warn=0 error=0 exception=0 total=0`
    - `[runtime:launch-infra] ...`
  - 不再输出 `[error] [runtime:launch] ...`（避免 runtime error 误报）。
- `isDevtoolsHttpPortError` 同步扩展为识别上述 infra 模式。

### 5.2 验证结果

日志：`/tmp/e2e-runtime-fix-verify.log`

- 观察到：
  - `[e2e-runtime-stats] warn=0 error=0 exception=0 total=0`
  - `[runtime:launch-infra] listen EPERM: operation not permitted 0.0.0.0`
- 结论：runtime warning/error 统计误报已修复。

## 6. 当前剩余问题（非本次 runtime 统计口径）

1. IDE 启动失败（EPERM）导致 IDE e2e 用例失败，需要本机权限/端口环境可用。
2. 全量 e2e 尾段仍可能触发 `EMFILE`，需提升系统文件监听上限或降低并发。
