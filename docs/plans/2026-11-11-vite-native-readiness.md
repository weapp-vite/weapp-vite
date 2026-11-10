# Vite 原生 watcher 就绪计数修正

## 首错与根因

依赖升级后的 Windows Node 24 CI 在 `vite-native-path-controls.test.ts` 中没有观察到 `ready` 后唯一一次文件创建；相同运行的 Node 22 对照通过。未增加超时、重复保存或切换轮询。

Vite 8.3.5 内置 Chokidar 的 `_addToNodeFs` 在缺失路径分支已经调用就绪回执，外层 `add` 又为相同返回值调用一次。空项目默认存在四个缺失的 env 文件监听目标，重复计数可以在根目录扫描和原生订阅完成前触发 `ready`。此时创建的文件可能被初始扫描吸收，受 `ignoreInitial` 过滤。

独立子进程的回归通过显式屏障阻塞根目录 `stat`，保留四个缺失 env 文件的真实系统回调，排空对应 Promise 与 nextTick 后才释放根目录。修复前稳定观察到 `readyBeforeRelease: true`、`registeredAtReady: false`；修复后两者分别为 `false`、`true`。拦截只存在于测试子进程，正式原生监听对照仍在真实 `ready` 后单次写入。

## 修改范围

- 通过 pnpm 的版本限定补丁删除外层重复就绪计数，保留缺失路径的父目录监听注册。
- 保留原有原生文件事件、单次创建和连续依赖拓扑保存测试。
- 失败时记录原生事件和公开 `getWatched()` 状态，区分没有系统事件与框架过滤。

该补丁作用于本仓 pnpm 依赖解析，不改变 registry 上 Vite 的发布包，也不代表未应用补丁的外部宿主已修复。后续升级 Vite 时须运行同一回归；上游实现修正后移除补丁。

文件系统拦截与清理放在独立 fixture，避免扩展现有对照测试的职责。没有修改 weapp-vite 的编译、输出写盘或 HMR 策略。
