# rolldown-require-bench

基于合成 TS 模块图对 `rolldown-require` 与 `unrun` 进行性能对比。

## 运行方式

```sh
BENCH_ITERATIONS=10 pnpm --filter rolldown-require-bench benchmark
```

环境：本地 M3，Node 22.21.1，冷启动，每轮清理 unrun 的 `.unrun` 缓存。

## 10 次迭代平均值（avg）

| 场景                                   | rolldown-require avg | unrun avg | 备注                                          |
| -------------------------------------- | -------------------- | --------- | --------------------------------------------- |
| tiny-static（25 modules）              | 60.52 ms             | 61.16 ms  | deps 26，rssΔ 中位 1.02 MB vs 0.64 MB         |
| medium-mixed（100 modules，动态每 10） | 49.85 ms             | 52.30 ms  | deps 102 vs 101，rssΔ 中位 2.29 MB vs 1.44 MB |
| large-static（200 modules）            | 55.47 ms             | 64.54 ms  | deps 201，rssΔ 中位 2.86 MB vs 1.33 MB        |

结论：在 10 次冷启动平均值下 rolldown-require 仍普遍更快，unrun 的内存增量略低。真实项目请按自身工作负载重复验证。
