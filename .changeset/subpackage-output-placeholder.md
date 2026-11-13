---
"weapp-vite": minor
"create-weapp-vite": patch
---

feat(weapp-vite): 为构建输出路径增加 [subpackage] 占位符，支持根据资源或代码所属分包自动生成分包目录，并让 build.assetsDir 与 chunkFileNames 参与该路径解析。

同步更新 create-weapp-vite 的模板依赖，保持与 weapp-vite 发布版本一致。
