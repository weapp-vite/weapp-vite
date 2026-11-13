---
"weapp-vite": minor
"create-weapp-vite": patch
"@mpcore/simulator": patch
---

feat(weapp-vite): 为构建输出路径增加 [subpackage] 占位符，支持根据资源或代码所属分包自动生成分包目录，并让 build.assetsDir 与 chunkFileNames 参与该路径解析。

同步更新 create-weapp-vite 的模板依赖，保持与 weapp-vite 发布版本一致。

提前解析显式 assetFileNames 模板以保持 CSS 资源引用正确；遵循 preserveSymlinks 统一来源路径身份，并拒绝去重资源落入其他消费者无法访问的分包。

按最终 JS/CSS 消费者校验同一物理资源的跨包引用，覆盖静态共享 chunk、聚合样式与独立分包访问边界；公共资源配置继续由 bundler 原生发射。

同步补齐 headless 的 getImageInfo 包内资源读取，使同一运行场景与真实微信 IDE 一致。
