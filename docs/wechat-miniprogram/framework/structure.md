<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html -->

# 目录结构

小程序包含一个描述整体程序的 `app` 和多个描述各自页面的 `page` 。

一个小程序主体部分由三个文件组成，必须放在项目的根目录，如下：

<table><thead><tr><th>文件</th> <th>必需</th> <th>作用</th></tr></thead> <tbody><tr><td><a href="./app-service/app.html">app.js</a></td> <td>是</td> <td>小程序逻辑</td></tr> <tr><td><a href="./config.html">app.json</a></td> <td>是</td> <td>小程序公共配置</td></tr> <tr><td><a href="./view/wxss.html">app.wxss</a></td> <td>否</td> <td>小程序公共样式表</td></tr></tbody></table>

一个小程序页面由四个文件组成，分别是：

<table><thead><tr><th>文件类型</th> <th>必需</th> <th>作用</th></tr></thead> <tbody><tr><td><a href="./app-service/page.html">js</a></td> <td>是</td> <td>页面逻辑</td></tr> <tr><td><a href="./view/wxml/">wxml</a></td> <td>是</td> <td>页面结构</td></tr> <tr><td><a href="./config.html#页面配置">json</a></td> <td>否</td> <td>页面配置</td></tr> <tr><td><a href="./view/wxss.html">wxss</a></td> <td>否</td> <td>页面样式表</td></tr></tbody></table>

**注意：为了方便开发者减少配置项，描述页面的四个文件必须具有相同的路径与文件名。**

### 允许上传的文件

在项目目录中，以下文件会经过编译，因此上传之后无法直接访问到： *.js、app.json、* .wxml、\*.wxss（其中 wxml 和 wxss 文件仅针对在 app.json 中配置了的页面）。除此之外，只有后缀名在白名单内的文件可以被上传，不在白名单列表内文件在开发工具能被访问到，但无法被上传。具体白名单列表如下：

1. wxs
2. png
3. jpg
4. jpeg
5. gif
6. svg
7. json
8. cer
9. mp3
10. aac
11. m4a
12. mp4
13. wav
14. ogg
15. silk
16. wasm
17. br
18. cert
