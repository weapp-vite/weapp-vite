---
"@wevu/api": patch
---

修复 `WeapiPromisify` 对“可选尾参”方法的类型推导：`getSystemInfoAsync` 等接口在类型层不再错误退化为 `Promise<void>`，恢复为与微信定义一致的返回值。同步收敛 `WeapiInstance` 类型组合与 `tsd` 断言，避免重载交叉导致的返回类型不稳定。
