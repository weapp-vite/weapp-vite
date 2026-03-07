---
'@wevu/api': patch
---

补齐抖音 API 清单提取逻辑：在原有 `typeof tt` 类型提取基础上，新增从 `@douyin-microapp/typings/api/**/*.d.ts` 的可调用导出中补充方法，修复 `showActionSheet`、`createRewardedVideoAd`、`createMediaRecorder` 等能力被低估的问题。同步更新兼容矩阵与测试断言，提升抖音侧及三端对齐覆盖率统计准确性。
