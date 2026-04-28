# HMR Lab

专用 HMR 优化基线 demo，目标是把“改了哪个文件、脏入口范围、最终写出了哪些产物、花了多久”稳定记录下来。

## 覆盖矩阵

| 类型 | 文件 |
| --- | --- |
| app 级 | `src/app.json`、`src/app.wxss`、`src/app.ts` |
| 原生页面 | `src/pages/native/index.{wxml,wxss,ts,json}` |
| 原生组件 | `src/components/probe-card/index.{wxml,wxss,ts,json}` |
| Vue SFC | `src/pages/sfc/index.vue` 的 template/script/style |
| HTML 模板 | `src/pages/html/index.html` |
| 共享依赖 | `src/shared/tokens.ts`、`src/shared/styles/shared.scss` |
| 共享模板/WXS | `src/shared/templates/*.wxml`、`src/shared/wxs/format.wxs` |
| 分包 | `src/subpackages/lab/pages/sub-native/index.{wxml,wxss,ts,json}` |

## 运行

```bash
pnpm benchmark:hmr:lab
```

默认输出：

- `.tmp/hmr-lab/report.json`：完整样本、profile、影响产物列表。
- `.tmp/hmr-lab/report.md`：适合人工查看的汇总表。

可选环境变量：

- `HMR_LAB_ITERATIONS=3`：每个场景采样次数。
- `HMR_LAB_FILTER=native`：只跑包含指定关键字的场景。
- `HMR_LAB_TIMEOUT_MS=30000`：单次等待超时。
- `HMR_LAB_FAIL_ON_ERROR=1`：任一场景失败时返回非零退出码，适合收敛成 CI 护栏后开启。

## 优化计划

1. 先用当前 demo 跑基线，按文件类型记录 `totalMs`、`watch->dirty`、`transform`、`write`、`dirty/pending/emitted` 和实际变动产物。
2. 对高影响范围场景优先分析：共享 TS、共享样式、共享模板/WXS、app.json、组件 JSON。
3. 每次优化只改一个 HMR 传播规则或缓存失效点，并用本 demo 对比优化前后报告。
4. 稳定后把同样采样结构下沉到 `templates/*`，模板侧只维护场景清单，不复制采样逻辑。
