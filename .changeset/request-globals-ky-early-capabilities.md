---
"weapp-vite": patch
---

fix(weapp-vite): 补齐 ky 等依赖在模块初始化期的 Web runtime globals 注入与能力探测。

ky 会在模块顶层缓存 `Request` / `ReadableStream` / `AbortController` 等能力探测结果，并通过 `globalThis.X` 读取构造器。此前自动识别白名单不包含 ky，成员访问形式的目标推导也会漏掉这些引用；installer 执行前的构造器还会抛出 `X is not initialized`，使顶层能力探测被异常中断并缓存结果。现在仅依赖 ky 也会启用注入，`globalThis.X` 形式的引用可被正确识别；三个构造器在 chunk 顶部即可构造，探测正常完成且结论与真实 polyfill 能力一致。installer 之后绑定自动转发到真实实现，globalThis 上的兜底值由 installer 替换。
