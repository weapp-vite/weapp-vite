---
"weapp-vite": minor
"create-weapp-vite": patch
---

multiPlatform 改为使用 `config/<platform>/project.config.json` 目录约定，禁用 `--project-config` 覆盖，并在构建时同步复制平台配置目录到产物根目录。
