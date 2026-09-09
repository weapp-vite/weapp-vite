---
"@mpcore/simulator": patch
---

修复 headless 测试启动器提前以空路径触发 App 生命周期的问题，改为使用实际首屏入口启动。普通启动的 referrerInfo 与微信一致保留空对象，并修复 Node 与浏览器模拟器启动快照丢失 scene、来源字段和同步查询时补入不存在字段的问题。
