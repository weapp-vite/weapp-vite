---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: `injectWeapi` 不再生成 `weapp-vite.weapi.d.ts`，并将 `wpi` 全局类型并入 `weapp-vite/client`，避免用户手动修改 `tsconfig` include。
