---
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-vite': patch
---

fix(vite): 修复 Vite 宿主的 npm 输出、干净项目受管类型生成、符号链接入口与引擎依赖兼容性。

- npm 自定义构建回调与手工映射由宿主原生 emit/write 发布，按整轮输出归属清理旧文件，保留 sourcemap、返回 `false` 跳过依赖的公开类型和父包 Node 解析语义。修正各平台默认 npm 输出根及相对目录的重复解释。
- 在真实构建开始后生成受管 TypeScript 文件，支持未运行 prepare 的干净项目；修复符号链接、自定义源码目录下的 React、插件与库入口识别。
- 联动更新 Rolldown 适配包的 peer 约束及脚手架依赖，避免严格安装时仍解析到要求旧引擎的发布包。
