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
| rolldown-require | 9.08     | 6.78        | 5.35 | 19.48 | 2.38              | 26   |
| unrun            | 13.53    | 5.57        | 5.51 | 44.84 | 1.14              | 26   |

### warm

| library          | avg (ms) | median (ms) | min  | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ----- | ----------------- | ---- |
| rolldown-require | 6.83     | 6.47        | 5.09 | 9.37  | 0.56              | 26   |
| unrun            | 8.95     | 8.07        | 5.96 | 13.81 | 0.25              | 26   |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 3.81     | 3.59        | 3.22 | 4.57 | 0.41              | 2    |
| unrun            | 3.05     | 3.03        | 2.45 | 3.88 | 0.56              | 2    |

## medium-mixed

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 7.56     | 6.63        | 6.08  | 11.23 | 3.64              | 102  |
| unrun            | 11.45    | 10.96       | 10.27 | 12.98 | 2.41              | 101  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 8.01     | 7.67        | 6.84  | 9.34  | 2.75              | 102  |
| unrun            | 12.47    | 11.79       | 10.66 | 15.43 | 1.42              | 101  |

### rebuild

| library          | avg (ms) | median (ms) | min  | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ----- | ----------------- | ---- |
| rolldown-require | 8.93     | 8.66        | 7.79 | 10.41 | 2.70              | 94   |
| unrun            | 10.79    | 10.27       | 9.13 | 14.33 | 1.03              | 93   |

## large-static

### cold

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 24.66    | 25.27       | 22.78 | 25.62 | 6.25              | 201  |
| unrun            | 32.59    | 33.10       | 29.84 | 34.25 | 2.53              | 201  |

### warm

| library          | avg (ms) | median (ms) | min   | max   | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ----- | ----- | ----------------- | ---- |
| rolldown-require | 24.97    | 25.42       | 22.97 | 26.23 | 2.59              | 201  |
| unrun            | 32.19    | 32.12       | 30.19 | 34.57 | 1.50              | 201  |

### rebuild

| library          | avg (ms) | median (ms) | min  | max  | rssΔ median (MiB) | deps |
| ---------------- | -------- | ----------- | ---- | ---- | ----------------- | ---- |
| rolldown-require | 3.69     | 3.41        | 2.72 | 5.86 | 0.05              | 2    |
| unrun            | 2.68     | 2.64        | 2.56 | 2.88 | 0.17              | 2    |

## Conclusion

本次测试中 rolldown-require 在更多场景/模式上更快（6 vs 3）。

- 判定基于 median 耗时（越小越快），共 9 个场景/模式。
- rolldown-require 更快：6；unrun 更快：3；持平：0。
- cold: rolldown-require 2 / unrun 1 / 持平 0
- warm: rolldown-require 3 / unrun 0 / 持平 0
- rebuild: rolldown-require 1 / unrun 2 / 持平 0
- tiny-static: cold unrun，warm rolldown-require，rebuild unrun
- medium-mixed: cold rolldown-require，warm rolldown-require，rebuild rolldown-require
- large-static: cold rolldown-require，warm rolldown-require，rebuild unrun
