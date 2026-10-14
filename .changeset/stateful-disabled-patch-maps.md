---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修正状态保持 HMR 在关闭 sourcemap 时仍为每个脚本补丁生成高精度映射的问题，减少随后被丢弃的映射分配，保留补丁执行、外部导入转换与启用映射时的源码定位。
