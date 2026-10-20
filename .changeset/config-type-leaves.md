---
"@weapp-core/api": patch
"@weapp-core/shared": patch
"@wevu/web-apis": patch
"@weapp-vite/i18n": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(types): 为网络默认选项和 wevu 构建配置提供不加载小程序宿主全局声明的类型入口，保留现有运行时 API 和完整宿主类型别名。weapp-vite 配置使用可序列化的默认值类型，提前拒绝编译产物无法保留的回调、正则和其他非 JSON 值，避免污染 Node/Vite 配置的 DOM 与全局类型。补齐公开声明的依赖闭包，并通过原生声明打包消除路径选项中不符合 NodeNext 的上游导入。
