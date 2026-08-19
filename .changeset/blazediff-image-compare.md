---
'weapp-ide-cli': patch
---

将 `weapp compare` 的像素对比引擎从 `pixelmatch` 换成 `@blazediff/core`，对比参数与结果语义保持不变，同一份截图基准的判定行为一致。
