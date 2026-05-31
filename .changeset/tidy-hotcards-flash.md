---
"weapp-vite": patch
"create-weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
---

修复开发态新增自动导入 Vue SFC 组件时，组件入口可能已被标记为 loaded 导致模板产物没有重新生成的问题。
修复开发态 HMR 新 bundle 复用旧 SFC asset 缓存时，slot fallback wrapper / shared template 等运行时资产可能没有重新 emit，导致微信 DevTools 偶发找不到产物文件的问题。
修复 wevu 运行时 setData 调度与 diff 处理中对象判定缓存不稳定的问题，降低运行时更新开销。
修复模板运行时表达式中成员链 ref 没有在使用前解引用的问题，避免 `JSON.stringify(query.data)` 这类表达式在小程序运行时误序列化 ref 对象。
同步发布 create-weapp-vite，保持脚手架模板依赖的 weapp-vite 版本与本次修复一致。
