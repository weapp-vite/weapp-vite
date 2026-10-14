---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 为不收集平台 API 事实的本地 npm 重写增加保守的负向检查，避免无关相对依赖和大型 runtime chunk 重复进入 Babel 遍历。转义、正则依赖、已本地化 interop 与默认平台事实收集仍保留原重写路径和输出语义。
