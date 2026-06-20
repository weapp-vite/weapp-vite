# MCP 可见变化演示提示词

```text
你现在连接的是 weapp-vite MCP，目标应用是 apps/tdesign-miniprogram-starter-retail。

请演示一次可见的页面运行时操作：
1. 连接微信开发者工具，打开 pages/home/home。
2. 截图保存到 .tmp/mcp-before.png。
3. 点击底部 tab 切到“购物车”，确认 active page 变为 pages/cart/index。
4. 在当前页面找一个可见节点，读取它的 markup、styles、measure。
5. 如果页面 state 里有可安全修改的展示字段，临时改成“由 MCP 修改的演示文本”；如果没有，就点击或输入触发一个明显 UI 变化。
6. 再截图保存到 .tmp/mcp-after.png。
7. 最后输出：用到的 MCP 工具、页面变化前后截图路径、当前页面路径、是否成功。
```
