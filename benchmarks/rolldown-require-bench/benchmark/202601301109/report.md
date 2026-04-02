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
| rolldown-require | 12.85    | 4.81        | 4.37 | 45.73 | 1.78              | 26   |
| unrun            | 12.84    | 6.24        | 5.30 | 40.46 | 1.06              | 26   |

### warm

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 8.16     | 8.40        | 5.52 | 9.71 | 0.91              | 26   |
| unrun            | 7.72     | 7.50        | 7.39 | 8.24 | 0.69              | 26   |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 3.20     | 3.12        | 2.79 | 3.61 | 0.36              | 2    |
| unrun            | 3.42     | 3.33        | 2.96 | 3.95 | 0.36              | 2    |

## medium-mixed

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 9.38     | 8.93        | 7.07  | 13.13 | 3.33              | 102  |
| unrun            | 14.19    | 12.66       | 11.74 | 20.25 | 2.30              | 101  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 8.16     | 7.44        | 6.59  | 10.90 | 1.47              | 102  |
| unrun            | 12.16    | 11.87       | 11.31 | 13.32 | 0.92              | 101  |

### rebuild

| library          | avg (ms) | median (ms) | min  | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ----- | ----------------- | ---- |
| rolldown-require | 9.43     | 9.78        | 8.04 | 10.43 | 1.56              | 94   |
| unrun            | 10.90    | 11.31       | 9.51 | 11.81 | 1.88              | 93   |

## large-static

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 29.16    | 30.14       | 24.04 | 32.50 | 6.56              | 201  |
| unrun            | 36.33    | 33.84       | 31.45 | 42.62 | 2.05              | 201  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 25.67    | 22.15       | 21.07 | 34.45 | 2.45              | 201  |
| unrun            | 36.58    | 34.98       | 32.45 | 44.70 | 1.38              | 201  |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 4.38     | 4.38        | 3.97 | 4.76 | 0.09              | 2    |
| unrun            | 3.16     | 3.28        | 2.78 | 3.37 | 0.30              | 2    |

## Conclusion

本次测试中 rolldown-require 在更多场景/模式上更快（7 vs 2）。

- 判定基于 median 耗时（越小越快），共 9 个场景/模式。
- rolldown-require 更快：7；unrun 更快：2；持平：0。
- cold: rolldown-require 3 / unrun 0 / 持平 0
- warm: rolldown-require 2 / unrun 1 / 持平 0
- rebuild: rolldown-require 2 / unrun 1 / 持平 0
- tiny-static: cold rolldown-require，warm unrun，rebuild rolldown-require
- medium-mixed: cold rolldown-require，warm rolldown-require，rebuild rolldown-require
- large-static: cold rolldown-require，warm rolldown-require，rebuild unrun
