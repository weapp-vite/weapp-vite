# 真实编译入口归因

现有 `scripts/ast-migration-profile.ts` 调用生产 `compileVueFile` / `transformScript`，记录墙钟、根进程 CPU、嵌套阶段和 Babel/native 计数。`attribution.ts` 只记录 Babel 调用点次数；两者均不能将 parse 次数或嵌套 wall 直接解释为阶段 CPU 占比。

## V8 主线程采样

`cpu.ts` 通过 Node inspector 采样真实 `compileVueFile`，不启用阶段观测或源码加载钩子。导入、5 次预热、结果对照、摘要生成和写文件在采样窗口外；窗口内默认执行 60 次真实编译，间隔 1 ms。不跨平台或跨输入自适应调整轮数，结果只用于定位热点，不作为速度验收。

采样前按仓库规则重建修改过的依赖，确认同机 E2E、构建和其他性能任务已退出，再串行执行：

```sh
node --import tsx scripts/astMigrationProfile/cpu.ts --output=.codex-tmp/compiler-cpu.json --raw-profile=.codex-tmp/compiler-local.cpuprofile
node --import tsx scripts/astMigrationProfile/cpu.ts --source=apps/wevu-vue-demo/src/pages/index/index.vue --output=.codex-tmp/wevu-cpu.json --raw-profile=.codex-tmp/wevu-local.cpuprofile
node --import tsx scripts/astMigrationProfile/cpu.ts --source=templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/goods/details/index.vue --output=.codex-tmp/retail-cpu.json --raw-profile=.codex-tmp/retail-local.cpuprofile
```

输出目录须已存在，每个文件须不存在；两个输出不能指向同一文件。`--iterations` 仅接受正整数；`WEAPP_VITE_NATIVE` 应取消或设为 `0`，保留 JS 热点基线。源码使用固定页面编译选项，记录在报告中，不等于加载原工程全部配置的 Vite 构建。

摘要保留原始 profile hash、输入与输出 hash、时间、采样数、GC/idle/unattributed、模块及函数的 self/inclusive 计数。self 分类按栈顶采样互斥，inclusive 表示样本调用栈包含该模块或函数，同一递归链只计一次；inclusive 行互相重叠，不可求和。百分比的分母始终包括全部样本，而非去掉 GC 或空闲后的子集。

这是 V8 主线程样本分布，不是进程总 CPU 时间占比。Rust 内部、worker 和子进程没有独立展开；采样间隔、Inspector 和系统调度也会影响结果。原始 `timeDeltas` 保存在本地 profile，摘要百分比按样本数计算，不冒充精确 CPU 时间。Frame 行列来自 V8 生成代码，未按 sourcemap 映射回 TypeScript。

最终采样编译的完整返回值、map 和告警与最后一次预热结果对照；不保留每个中间编译结果，避免人为延长对象存活期影响 GC。未经采样的配对计时及完整 build/HMR 验收仍由各自工具负责。

本地 `.cpuprofile` 包含原始绝对路径，分享前需要检查；摘要按仓库相对路径、包路径、Node 内建或稳定 external/unattributed 标签整理，不输出机器路径。未知 sample ID、重复节点或非法调用图直接报错，避免生成看似有效的占比。

Native AST Analysis CI 在三种操作系统中串行采集上述三份输入，仅上传脱敏的 JSON 摘要；原始 `.cpuprofile` 不上传。这些诊断与后续 off/on 性能验收分开，不用采样窗口内的耗时判定提速。

工具检查：

```sh
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/astMigrationProfile
pnpm exec tsc -p scripts/astMigrationProfile/tsconfig.json
```
