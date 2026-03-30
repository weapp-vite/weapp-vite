---
'@mpcore/simulator': patch
---

修复 headless 文件系统在已保存文件之间重命名覆盖时错误继承源文件 `createTime` 的问题，确保覆盖后保留目标文件的创建时间。
