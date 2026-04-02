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
| rolldown-require | 18.17    | 8.41        | 6.34 | 56.76 | 1.88              | 26   |
| unrun            | 18.44    | 7.57        | 6.78 | 61.10 | 1.09              | 26   |

### warm

| library          | avg (ms) | median (ms) | min  | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ----- | ----------------- | ---- |
| rolldown-require | 7.47     | 8.15        | 5.72 | 8.73  | 1.19              | 26   |
| unrun            | 9.18     | 8.32        | 8.05 | 12.29 | 0.63              | 26   |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 3.95     | 3.79        | 3.74 | 4.39 | 0.36              | 2    |
| unrun            | 3.58     | 3.48        | 3.41 | 3.87 | 0.38              | 2    |

## medium-mixed

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 11.38    | 10.40       | 9.15  | 15.90 | 3.50              | 102  |
| unrun            | 20.21    | 16.85       | 15.02 | 31.63 | 2.39              | 101  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 10.01    | 9.72        | 8.98  | 11.85 | 2.38              | 102  |
| unrun            | 19.42    | 17.92       | 15.13 | 25.04 | 1.44              | 101  |

### rebuild

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 12.92    | 12.55       | 11.81 | 14.45 | 2.34              | 94   |
| unrun            | 12.30    | 12.15       | 10.97 | 14.11 | 1.83              | 93   |

## large-static

### cold

| library          | avg (ms) | median (ms) | min   | max    | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ------ | ----------------- | ---- |
| rolldown-require | 33.61    | 32.82       | 27.92 | 40.34  | 4.48              | 201  |
| unrun            | 59.84    | 40.15       | 36.56 | 109.07 | 0.00              | 201  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 39.04    | 36.83       | 27.76 | 58.31 | 2.45              | 201  |
| unrun            | 33.69    | 31.51       | 30.75 | 41.13 | 1.56              | 201  |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 3.41     | 3.46        | 2.91 | 3.89 | 0.09              | 2    |
| unrun            | 3.71     | 3.72        | 3.02 | 4.29 | 0.33              | 2    |

## Conclusion

本次测试中 rolldown-require 在更多场景/模式上更快（5 vs 4）。

- 判定基于 median 耗时（越小越快），共 9 个场景/模式。
- rolldown-require 更快：5；unrun 更快：4；持平：0。
- cold: rolldown-require 2 / unrun 1 / 持平 0
- warm: rolldown-require 2 / unrun 1 / 持平 0
- rebuild: rolldown-require 1 / unrun 2 / 持平 0
- tiny-static: cold unrun，warm rolldown-require，rebuild unrun
- medium-mixed: cold rolldown-require，warm rolldown-require，rebuild unrun
- large-static: cold rolldown-require，warm unrun，rebuild rolldown-require
