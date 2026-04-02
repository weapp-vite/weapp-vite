# Benchmark Report (iterations: 5)

## Versions

| package          | version |
| ---------------- | ------- |
| rolldown-require | 2.0.1   |
| unrun            | 0.2.26  |

## tiny-static

### cold

| library          | avg (ms) | median (ms) | min  | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ----- | ----------------- | ---- |
| rolldown-require | 12.96    | 6.23        | 5.19 | 40.62 | 1.64              | 26   |
| unrun            | 23.57    | 6.33        | 5.97 | 93.12 | 1.05              | 26   |

### warm

| library          | avg (ms) | median (ms) | min  | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ----- | ----------------- | ---- |
| rolldown-require | 7.90     | 7.79        | 6.15 | 9.80  | 1.25              | 26   |
| unrun            | 9.31     | 8.07        | 7.41 | 13.40 | 0.67              | 26   |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 3.87     | 3.61        | 3.46 | 4.92 | 0.38              | 2    |
| unrun            | 4.11     | 4.21        | 3.34 | 4.63 | 0.34              | 2    |

## medium-mixed

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 11.07    | 11.37       | 9.06  | 12.66 | 3.36              | 102  |
| unrun            | 15.28    | 15.41       | 12.63 | 17.66 | 2.42              | 101  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 18.19    | 14.35       | 9.24  | 41.23 | 2.44              | 102  |
| unrun            | 19.89    | 20.26       | 13.60 | 24.09 | 1.13              | 101  |

### rebuild

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 25.00    | 13.36       | 10.79 | 48.48 | 1.50              | 94   |
| unrun            | 13.06    | 10.94       | 10.21 | 18.43 | 1.66              | 93   |

## large-static

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 41.83    | 39.40       | 35.91 | 54.68 | 4.70              | 201  |
| unrun            | 40.46    | 39.03       | 33.47 | 48.98 | 1.67              | 201  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 31.45    | 32.29       | 27.93 | 34.30 | 1.63              | 201  |
| unrun            | 35.08    | 34.16       | 30.73 | 42.25 | 1.25              | 201  |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 4.45     | 3.95        | 3.69 | 6.78 | 0.13              | 2    |
| unrun            | 3.19     | 3.17        | 2.77 | 3.75 | 0.34              | 2    |

## Conclusion

本次测试中 rolldown-require 在更多场景/模式上更快（6 vs 3）。

- 判定基于 median 耗时（越小越快），共 9 个场景/模式。
- rolldown-require 更快：6；unrun 更快：3；持平：0。
- cold: rolldown-require 2 / unrun 1 / 持平 0
- warm: rolldown-require 3 / unrun 0 / 持平 0
- rebuild: rolldown-require 1 / unrun 2 / 持平 0
- tiny-static: cold rolldown-require，warm rolldown-require，rebuild rolldown-require
- medium-mixed: cold rolldown-require，warm rolldown-require，rebuild unrun
- large-static: cold unrun，warm rolldown-require，rebuild unrun
