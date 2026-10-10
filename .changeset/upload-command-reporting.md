---
'create-weapp-vite': patch
'weapp-vite': minor
---

feat(upload): 新增独立 upload 命令的结构化结果、六平台汇总和本地执行期限。

- 独立 `upload` 新增 `--json`、遇错停止的六平台汇总和 `--timeout` 本地期限，统一官方结果、微信任务进度、小红书百分比与支付宝公开事件；保留预览及旧微信 IDE 上传边界。
