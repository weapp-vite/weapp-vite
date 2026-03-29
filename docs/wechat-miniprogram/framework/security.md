<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/security.html -->

# 安全指引

## 开发原则与注意事项

本文档整理了部分小程序开发中常见的安全风险和漏洞，用于帮助开发者在开发环节中发现和修复相关漏洞，避免在上线后对业务和数据造成损失。开发者在开发环节中必须基于以下原则：

1. 互不信任原则，不要信任用户提交的数据，包括第三方系统提供的数据，必要的数据校验必须放在后台校验。
2. 最小权限原则，代码、模块等只拥有可以完成任务的最小权限，不赋予不必要的权限。
3. 禁止明文保存用户敏感数据。
4. 小程序代码（不包括云函数代码）跟传统 Web 应用的前端代码类似，可被外部获取及进行反混淆，重要业务逻辑应放在后台代码或云函数中进行。
5. 后台接口调用以及云函数调用，必须进行有效的身份鉴权。

## 通用

### 接口鉴权

接口鉴权是指后台接口（包括自建后台接口与云函数）在被调用时需要对本次接口调用进行权限校验，否则容易发生越权行为。如商品删除接口，后台在收到请求时应当校验调用者的身份信息（如 openid、 ip 地址、开发者自定义的登录态信息等），只有指定用户才可以通过校验进行删除。

越权通常分为平行越权和垂直越权：

- 平行越权
  平行越权是指相同角色之间的越权。 A1、 A2 都是普通用户， A1 通过请求后台接口 userinfo.php?id=A1 来获取用户 A1 自己的信息，如果 userinfo.php 没有进行权限校验，用户 A1 把请求改为 userinfo.php?id=A2 便可以获取到 A2 用户的信息，造成 A2 用户信息的泄露。
- 垂直越权
  垂直越权是指不同角色之间的越权。 B1 是管理员， B2 是普通用户，管理员 B1 通过请求后台接口 getalluserinfo.php 可以获取所有注册用户的信息，如果 getalluserinfo.php 没有进行权限校验， B2 用户也可以请求 getalluserinfo.php 来获取所有注册用户的信息，出现越权行为。

**开发建议：**

1. 敏感数据、能力相关接口需要在后台进行鉴权。通常可校验 openid、 IP 地址、自定义登陆态等信息。
2. 鉴权逻辑应放在后台进行，不应在小程序前端以隐藏页面、隐藏按钮等方式来代替。参照原则4。
3. 鉴权代码示例（仅供参考）
    - 自建后台鉴权
      ```php
      function actionDelete(){
          $item_id = $_POST["item_id"];
          $openid = $_POST["openid"];
          $ip = $_SERVER['REMOTE_ADDR'];
          $user_role = $_SESSION["user_role"];
          if ($openid === "xxx" &&
              $ip === "192.168.0.101" &&
              $user_role === "admin") {
                  // 进行删除操作
                  // ...
                  return 0;
              } else {
                  // 记录非法请求
                  // ...
                  return -1;
              }
      }
      ```
    - 云函数接口鉴权
      ```js
      exports.main = async (event, context) => {
          const { OPENID, APPID, UNIONID } = cloud.getWXContext();
          if (OPENID === "xxx") {
              // 进行删除操作
              // ...
          } else {
              // 记录非法请求
              // ...
          }
      }
      ```

### 代码管理与泄漏

1. 当使用 git、 svn 等版本管理工具时，会产生 .git 等目录。某些编辑器或软件也会在运行过程中生成临时文件。若这些目录或文件被带到生产环境，则可能发生源码泄漏。
2. 使用 [小程序代码管理平台](https://git.weixin.qq.com/) 或 github 等第三方平台时需要注意项目权限，不要公开敏感、内部项目。

**开发建议：**

1. 备份文件和版本管理工具产生的文件不要同步到 Web 目录下。
2. 禁止外部访问 .git 等目录与文件。
3. 在 [小程序代码管理平台](https://git.weixin.qq.com/) 等管理平台内配置适当的访问权限。

## 小程序

### 信息泄露

敏感信息是指一旦泄露可能会对开发者的业务、合作伙伴和用户带来利益损害的数据，包括但不限于 **账号 Appsecret、特权账号信息、后台加密密钥、登录账户密码、用户身份证号、手机号、银行卡号等** 。

**开发建议：**

1. 敏感信息不应以明文、注释、可逆的编码方式（如 base64）、不安全散列函数（如 MD5、 SHA1）等形式出现在小程序文件内。
2. 部分敏感信息如用户的银行卡号、手机号等需要用于展示的，需要进行脱敏处理。常用脱敏规范如下：
  <table><thead><tr><th>敏感信息类型</th> <th>展示样例</th></tr></thead> <tbody><tr><td>姓名</td> <td>名字只有两个字，对第一个字打码，如：*三。 多于两个字，只保留第一个和最后一个，其余都打码，如：王*四、欧**五</td></tr> <tr><td>身份证</td> <td>只显示第一位和最后一位，如：3****************1</td></tr> <tr><td>手机号</td> <td>除去手机国际码后，手机号位数不少于10位时，只显示前三位和最后两位，如：156******77。手机号位数少于10位时，只显示前两位和后两位，如：12*****89。国家码可以完全显示。</td></tr> <tr><td>银行卡</td> <td>只显示最后4位，如：************1234</td></tr></tbody></table>
3. **如果小程序存在敏感信息泄露的问题，微信开放平台将有可能下架该小程序，并暂停该小程序的相关服务。**

### 授权用户信息变更

1、 授权用户资料变更：当部分用户的资料存在风险时，平台会对用户资料进行清理，并通过消息推送服务器通知最近30天授权过的小程序开发者，我们建议开发者留意响应该事件，及时主动更新或清理用户的头像及昵称，降低风险。 2、 授权用户资料撤回：当用户撤回授权信息时，平台会通过消息推送服务器通知给小程序开发者，请开发者注意及时删除用户信息。 3、 授权用户完成注销：当授权用户完成注销后，平台会通过消息推送服务器通知给小程序开发者，请依法依规及时履行相应个人信息保护义务，保护用户权益。 点击查看 [消息推送服务器配置](./server-ability/message-push.md)

#### 事件推送示例：

##### XML

```
<xml>

<ToUserName><![CDATA[gh_870882ca4b1]]></ToUserName>

<FromUserName><![CDATA[owAqB1v0ahK_Xlc7GshIDdf2yf7E]]></FromUserName>

<CreateTime>1626857200</CreateTime>

<MsgType><![CDATA[event]]></MsgType>

<Event><![CDATA[user_authorization_revoke]]></Event>

<OpenID><![CDATA[owAqB1nqaOYYWl0Ng484G2z5NIwU]]></OpenID>

<AppID><![CDATA[wx13974bf780d3dc89]]></AppID>

<RevokeInfo><![CDATA[1]]></RevokeInfo>

<PluginID><![CDATA[wx13974bf780d3dc89]]></PluginID>

< OpenPID><![CDATA[G7esq5NVzP76HIHoB95t4CVBP6to]]></OpenPID>

</xml>
```

##### JSON

```
{

"ToUserName": "gh_870882ca4b1",

"FromUserName": "oaKk346BaWE-eIn4oSRWbaM9vR7s",

"CreateTime": 1627359464,

"MsgType": "event",

"Event": "user_authorization_revoke",

"OpenID": "oaKk343WOktAaT2ygsX138BGblrg",

"AppID": "wx13974bf780d3dc89",

"RevokeInfo": "1",

"PluginID": "wx13974bf780d3dc89",

"OpenPID": " G7esq5NVzP76HIHoB95t4CVBP6to"

}
```

#### 事件字段定义

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>ToUserName</td> <td>string</td> <td>小程序的UserName</td></tr> <tr><td>FromUserName</td> <td>string</td> <td>平台推送服务UserName</td></tr> <tr><td>MsgType</td> <td>string</td> <td>默认为：Event</td></tr> <tr><td>Event</td> <td>string</td> <td>user_info_modified：用户资料变更，user_authorization_revoke：用户撤回，user_authorization_cancellation：用户完成注销；</td></tr> <tr><td>CreateTime</td> <td>number</td> <td>发送时间</td></tr> <tr><td>OpenID</td> <td>string</td> <td>授权用户OpenID</td></tr> <tr><td>UnionID</td> <td>string</td> <td>授权用户UnionID</td></tr> <tr><td>AppID</td> <td>string</td> <td>小程序的AppID</td></tr> <tr><td>RevokeInfo</td> <td>string</td> <td>用户撤回的授权信息，1:车牌号,2:地址,3:发票信息,4:蓝牙,5:麦克风,6:昵称和头像,7:摄像头,8:手机号,12:微信运动步数,13:位置信息,14:选中的图片或视频,15:选中的文件,16:邮箱地址,18:选择的位置信息,19:昵称输入键盘中选择的微信昵称,20:获取用户头像组件中选择的微信头像</td></tr> <tr><td>PluginID</td> <td>string</td> <td>插件场景用户撤回，插件的AppID</td></tr> <tr><td>OpenPID</td> <td>string</td> <td>插件场景用户撤回，撤回用户的OpenPID</td></tr></tbody></table>

### 小程序违规处罚信息通知

当小程序存在违规行为时，平台会通过消息推送服务器通知给小程序开发者，建议小程序开发者注意及时接收相关通知进行排查整改，此通知不影响已有站内信等通知方式。 点击查看 [消息推送服务器配置](./server-ability/message-push.md)

#### 1. 事件字段定义

1.1 字段【Event】等于"wxa\_punish\_event"时，则表示这是一条关于【小程序违规处罚事件】的通知。

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>Event</td> <td>string</td> <td>事件名称：wxa_punish_event，即小程序违规处罚信息</td></tr> <tr><td>event_type</td> <td>number</td> <td>事件类型。1：警告；2：功能封禁；3：下架；4：账号封禁；10：页面封禁。</td></tr> <tr><td>punish_id</td> <td>string</td> <td>违规处罚ID，用于唯一标识每次违规</td></tr> <tr><td>appid</td> <td>string</td> <td>被处罚小程序的AppID</td></tr> <tr><td>punish_time</td> <td>number</td> <td>违规时间（UNIX时间戳）</td></tr> <tr><td>illegal_reason</td> <td>string</td> <td>违规原因</td></tr> <tr><td>illegal_content</td> <td>string</td> <td>违规内容</td></tr> <tr><td>rule_name</td> <td>string</td> <td>违反规则名称</td></tr> <tr><td>rule_url</td> <td>string</td> <td>违反规则链接</td></tr> <tr><td>adjust_guide_url</td> <td>string</td> <td>违规申诉及整改指引链接</td></tr> <tr><td>detail</td> <td>string</td> <td>违规处罚详情，字段内容为JSON字符串，JSON具体结构取决于event_type，请参照下方说明对该字段中包含的JSON字符串进行正确的解析</td></tr></tbody></table>

##### 1.2违规处罚事件详情（detail详细释义）

- 当 **event\_type=1** 时 **detail** 中的JSON字符串结构如下：
  <table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>warned_type</td> <td>number</td> <td>警告类型。1：警告账号封禁；2：警告功能封禁；3：警告下架。</td></tr> <tr><td>rectify_deadline</td> <td>number</td> <td>警告的截止时间(UNIX时间戳)</td></tr> <tr><td>warned_function_names</td> <td>array&lt;string&gt;</td> <td>警告要封禁的功能项列表，如需获取列表中每个功能项的封禁时长，可直接在warned_ban_days的对应索引处获得，warned_function_names和warned_ban_days总是一一对应。（该字段仅当warned_type=2时生效）</td></tr> <tr><td>warned_ban_days</td> <td>array&lt;number&gt;</td> <td>警告封禁的天数列表。当warned_type=1时则该列表仅有一项，代表警告要封禁小程序账号的天数。当warned_type=2时列表中的每一项分别代表warned_function_names中对应索引处的功能项被警告要封禁的天数。当warned_type=3时则该列表仅有一项，代表警告要下架小程序的天数。注：0代表永久封禁</td></tr></tbody></table>
- 当 **event\_type=2** 时 **detail** 中的JSON字符串结构如下：
  <table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>banned_days</td> <td>array&lt;number&gt;</td> <td>功能项被封禁的天数列表，列表中的每一项分别代表banned_function_names中对应索引处的功能项被封禁的天数。注：0代表永久封禁</td></tr> <tr><td>banned_function_names</td> <td>array&lt;string&gt;</td> <td>被封禁的功能项列表，如需获取列表中每个功能项的封禁时长，可直接在banned_days的对应索引处获得，banned_days和banned_function_names总是一一对应。</td></tr></tbody></table>
- 当 **event\_type=3** 时 **detail** 中的JSON字符串结构如下：
  <table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>suspended_days</td> <td>number</td> <td>下架天数。注：0代表永久下架</td></tr></tbody></table>
- 当 **event\_type=4** 时 **detail** 中的JSON字符串结构如下：
  <table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>banned_days</td> <td>number</td> <td>账号封禁天数。注：0代表永久封禁</td></tr></tbody></table>
- 当 **event\_type=5** 时 **detail** 中的JSON字符串结构如下：
  <table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>path</td> <td>string</td> <td>封禁的页面路径</td></tr></tbody></table>

#### 2. 事件推送参数示例

- **event\_type=1**
    - **warned\_type=1**
      ```json
      {
          "ToUserName": "gh_1d6c1222test",
          "FromUserName": "oyeHc4i5LqBbWLVTfnhf-3TZ4BNk",
          "CreateTime": 1699803867,
          "MsgType": "event",
          "Event": "wxa_punish_event",
          "punish_id": "649557",
          "appid": "wx54a8eaa26606test",
          "punish_time": 1699803865,
          "illegal_reason": "存在诱导分享行为",
          "illegal_content": [
              "违规内容测试"
          ],
          "detail": "{\"warned_type\":1,\"rectify_deadline\":1699796571,\"warned_function_names\":[],\"warned_ban_days\":[3]}",
          "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_5-1-滥用分享行为",
          "rule_name": "《微信小程序平台运营规范》5.行为规范-5.1滥用分享行为",
          "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
          "event_type": 1
      }
      ```
    - **warned\_type=2**
      ```json
      {
          "ToUserName": "gh_1d6c1222test",
          "FromUserName": "oyeHc4pIdqHZwh80SufyUuIzSenw",
          "CreateTime": 1699795665,
          "MsgType": "event",
          "Event": "wxa_punish_event",
          "punish_id": "649551",
          "appid": "wx54a8eaa26606test",
          "punish_time": 1699795663,
          "illegal_reason": "存在诱导分享行为",
          "illegal_content": [
              "违规内容测试"
          ],
          "detail": "{\"warned_type\":2,\"rectify_deadline\":1699796571,\"warned_function_names\":[\"分享朋友圈\",\"客服消息接口\"],\"warned_ban_days\":[1,1]}",
          "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_5-1-滥用分享行为",
          "rule_name": "《微信小程序平台运营规范》5.行为规范-5.1滥用分享行为",
          "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
          "event_type": 1
      }
      ```
    - **warned\_type=3**
      ```json
      {
          "ToUserName": "gh_1d6c1222test",
          "FromUserName": "oyeHc4tGxCvPcXlKeFI5tU0jV_yw",
          "CreateTime": 1699795665,
          "MsgType": "event",
          "Event": "wxa_punish_event",
          "punish_id": "649551",
          "appid": "wx54a8eaa26606test",
          "punish_time": 1699795663,
          "illegal_reason": "存在诱导分享行为",
          "illegal_content": [
              "违规内容测试"
          ],
          "detail": "{\"warned_type\":3,\"rectify_deadline\":1699796571,\"warned_function_names\":[],\"warned_ban_days\":[1]}",
          "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_5-1-滥用分享行为",
          "rule_name": "《微信小程序平台运营规范》5.行为规范-5.1滥用分享行为",
          "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
          "event_type": 1
      }
      ```
- **event\_type=2**
  ```json
  {
      "ToUserName": "gh_1d6c1222test",
      "FromUserName": "oyeHc4gSrT2S8jG2Ll1ZS16rwqQk",
      "CreateTime": 1699791600,
      "MsgType": "event",
      "Event": "wxa_punish_event",
      "punish_id": "13577492",
      "appid": "wx54a8eaa26606test",
      "punish_time": 1699791599,
      "illegal_reason": "存在诱导分享行为",
      "illegal_content": [
          "违规内容测试"
      ],
      "detail": "{\"banned_days\":[1,1],\"banned_function_names\":[\"分享朋友圈\",\"客服消息接口\"]}",
      "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_5-1-滥用分享行为",
      "rule_name": "《微信小程序平台运营规范》5.行为规范-5.1滥用分享行为",
      "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
      "event_type": 2
  }
  ```
- **event\_type=3**
  ```json
  {
      "ToUserName": "gh_1d6c1222test",
      "FromUserName": "oyeHc4qHkaYV-0NYupPZBTBrBNuw",
      "CreateTime": 1699801563,
      "MsgType": "event",
      "Event": "wxa_punish_event",
      "punish_id": "13577869",
      "appid": "wx54a8eaa26606test",
      "punish_time": 1699801560,
      "illegal_reason": "存在诱导分享行为",
      "illegal_content": [
          "违规内容测试"
      ],
      "detail": "{\"suspended_days\":1}",
      "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_5-1-滥用分享行为",
      "rule_name": "《微信小程序平台运营规范》5.行为规范-5.1滥用分享行为",
      "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
      "event_type": 3
  }
  ```
- **event\_type=4**
  ```json
  {
      "ToUserName": "gh_1d6c1222test",
      "FromUserName": "oyeHc4jjAdCWq1klrk-puPMe0FC4",
      "CreateTime": 1699784111,
      "MsgType": "event",
      "Event": "wxa_punish_event",
      "punish_id": "9328325",
      "appid": "wx54a8eaa26606test",
      "punish_time": 1699784109,
      "illegal_reason": "存在诱导分享行为",
      "illegal_content": [
          "测试违规内容/证据"
      ],
      "detail": "{\"banned_days\":3}",
      "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_5-1-滥用分享行为",
      "rule_name": "《微信小程序平台运营规范》5.行为规范-5.1滥用分享行为",
      "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
      "event_type": 4
  }
  ```
- **event\_type=10**
  ```json
  {
      "ToUserName": "gh_1d6c1222test",
      "FromUserName": "oyeHc4n0I6U3A4Fq7tfOAqmAJy8E",
      "CreateTime": 1699802583,
      "MsgType": "event",
      "Event": "wxa_punish_event",
      "punish_id": "94185814",
      "appid": "wx54a8eaa266009d6a",
      "punish_time": 1699802425,
      "illegal_reason": "发布低俗、性暗示或色情信息",
      "illegal_content": [
          "测试证据"
      ],
      "detail": "{\"path\":\"pages/fengjin/fengjin\"}",
      "rule_url": "https://developers.weixin.qq.com/miniprogram/product/index.html#_6-2-色情低俗内容",
      "rule_name": "《微信小程序平台运营规范》6.信息内容规范-6.2色情低俗内容",
      "adjust_guide_url": "https://mp.weixin.qq.com/s/73rLZmwPeQ87Q89DYQcfkw",
      "event_type": 10
  }
  ```

## 后台（包括云函数与自建后台）

### 注入漏洞

注入漏洞（SQL、 命令等）通常指用户绕过后台代码限制，直接在数据库、 shell 内执行自定义代码。

常见的注入漏洞有：

#### SQL 注入

SQL 注入是指 Web 程序代码中对于用户提交的参数未做有效过滤就直接拼接到 SQL 语句中执行，导致参数中的特殊字符打破了 SQL 语句原有逻辑，黑客可以利用该漏洞执行任意 SQL 语句。

**开发建议：**

1. 使用数据库提供的参数化查询来进行数据库操作，不允许直接通过拼接字符串的方式来合成 SQL 语句。
2. 如果存在部分情况需要通过拼接的方式来合成 SQL ，拼接的变量必须要经过处理：
    - 对于整数，需要判断变量是否为整数类型。
    - 对于字符串，需要对单引号、双引号等做转义处理。
3. 避免 Web 应用显示 SQL 的报错信息。
4. 保证 Web 应用里每一数据层的编码统一。

#### 命令注入

命令注入漏洞是指 Web 应用未对用户可控参数进行有效过滤，攻击者可以构造恶意参数拼接到命令上来执行任意命令。

**开发建议：**

- 对用户输入的数据（如 ;、|、&等）进行过滤或转义。

### 弱口令

弱口令指管理后台的用户名密码设置得较为简单或者使用默认账号。攻击者可以通过登录这些账号修改后台数据或进行下一步的入侵操作。

**开发建议：**

1. 后台服务禁用默认账号，修改后台弱口令。
2. 敏感服务增加二次验证机制，如短信验证码、邮箱验证码等。

### 文件上传漏洞

文件上传漏洞是指 Web 应用允许用户上传指定文件，但未对文件类型、格式等做合法性校验，导致可以上传非预期格式的文件。

**开发建议：**

- 正确解析上传文件的文件类型，通过白名单的方式限制可上传的文件类型。

### 文件下载

文件下载漏洞是指 Web 应用允许用户通过指定路径和文件名的方式来下载对应的文件，但未正确限制可下载文件所在的目录范围，导致预期范围外的文件被下载泄露。

**开发建议：**

1. 正确限制可下载文件所在的目录范围
2. 通过指定文件 id 的方式来查找下载对应的文件

### 目录遍历

目录遍历是指由后台服务对用户输入验证不足或配置不严谨导致的服务器目录内容泄漏。外部可能通过目录遍历获取系统文件、后台代码等敏感文件。

**开发建议：**

1. web 服务配置
    - 服务端禁止展示目录
    - 设置目录访问权限
    - 在每个目录下放置一个空的 index.html 页面
2. web 应用代码
    - 严格检查文件路径参数，限定文件的范围

### 条件竞争

条件竞争比较常见的例子是攻击者通过并发 https 请求而达到多次获奖、多次收获、多次获赠等非正常逻辑所能触发的效果。

- 漏洞代码示例
  ```cpp
  // 从DB里查询该用户剩余获奖次数，初始值为1
  int remain_times = SelectRemainTimes();

  if(remain_times > 0){
      EarnRewards();          // 用户获得奖励
      ClearRemainTimes();     // 在DB里把该用户的剩余获奖次数清零
  }
  ```
  开发者的设计本意是只允许用户获得一次奖励，但当出现并发请求时，有可能出现请求 A 和请求 B 都刚好执行完第2行代码的情况，此时两个请求的 remain\_times 都为1，也就是可以通过第4行代码的判断，获得两次奖励。

**开发建议：**

- 对关键（完整）逻辑加锁操作或把关键逻辑以队列任务的形式去进行处理。
