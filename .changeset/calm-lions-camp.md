---
"wevu": patch
"create-weapp-vite": patch
---

fix(wevu)：修复 store `direct` 通知在订阅回调内二次修改状态时可能出现的重入更新风暴问题，避免小程序模拟器长时间无响应；同时补充 `wevu-features` 的 `use-store` 能力展示与对应 e2e 回归覆盖，提升交互稳定性与可验证性。
