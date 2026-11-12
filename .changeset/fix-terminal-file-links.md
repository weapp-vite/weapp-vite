---
"weapp-ide-cli": patch
---

fix(weapp-ide-cli): 为交互式终端中的配置文件和 CLI 路径提示添加超链接，显示文字保留原始路径，文件地址及特殊字符编码隐藏在链接目标中。在支持 OSC 8 的 macOS Terminal 中可按 Command 双击打开对应文件，重定向日志与配置数据不添加超链接控制序列。
