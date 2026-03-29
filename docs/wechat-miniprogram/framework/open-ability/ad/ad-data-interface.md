<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/ad-data-interface.html -->

# 广告分析数据接口说明

向所有成为流量主的公众号、小程序、小游戏开发者开放数据接口。通过数据接口，开发者可以获取与公众平台官网统计模块类似但更灵活的数据，还可根据需要进行高级处理。

请注意：

1. 接口侧数据库中仅存储了2016年1月1日之后的数据，将无法查询到此前的数据，即使查到，也是不可信的脏数据；
2. 建议开发者在调用接口获取数据后，将数据保存在自身数据库中，以最大化访问的效率，也降低微信侧接口调用的不必要损耗；
3. 由于数据量较大, 所有接口采取分页获取的方式, 每页最大获取量为90。（eg：total\_num 为100，则当page = 1，page\_size = 10，则返回前10条；page = 1，page\_size = 20，则返回前20条；page = 2，page\_size = 10，则返回第11条到第20条）
4. 广告位枚举值变更说明
    - 由于多个接口都使用了广告位参数，为保证体验的一致性和参数的可读性，我们做了一些变更，所有接口均支持以 **广告位类型名称（ad\_slot）** 传递参数，回包时新增这个名称来代表相关含义。此前的参数 slot\_id 也可继续使用并回传。具体为：

<table><thead><tr><th style="text-align:left">广告位类型名称（ad_slot）</th> <th style="text-align:left">广告位类型</th></tr></thead> <tbody><tr><td style="text-align:left">SLOT_ID_BIZ_BOTTOM</td> <td style="text-align:left">公众号底部广告</td></tr> <tr><td style="text-align:left">SLOT_ID_BIZ_MID_CONTEXT</td> <td style="text-align:left">公众号文中广告</td></tr> <tr><td style="text-align:left">SLOT_ID_BIZ_VIDEO_END</td> <td style="text-align:left">公众号视频后贴</td></tr> <tr><td style="text-align:left">SLOT_ID_BIZ_SPONSOR</td> <td style="text-align:left">公众号互选广告</td></tr> <tr><td style="text-align:left">SLOT_ID_BIZ_CPS</td> <td style="text-align:left">公众号返佣商品</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_BANNER</td> <td style="text-align:left">小程序banner</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_REWARD_VIDEO</td> <td style="text-align:left">小程序激励视频</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_INTERSTITIAL</td> <td style="text-align:left">小程序插屏广告</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_VIDEO_FEEDS</td> <td style="text-align:left">小程序视频广告</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_VIDEO_BEGIN</td> <td style="text-align:left">小程序视频前贴</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_BOX</td> <td style="text-align:left">小程序格子广告</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_TEMPLATE</td> <td style="text-align:left">小程序原生模板广告</td></tr> <tr><td style="text-align:left">SLOT_ID_WEAPP_COVER</td> <td style="text-align:left">封面广告</td></tr></tbody></table>

## 接口总览

广告分析接口目前可用于获得“公众平台 → 流量主 → 数据统计”页面展示的部分广告数据和“公众平台 → 流量主 → 财务管理”页面展示的部分收入数据，与小程序相关的接口列表如下:

<table><thead><tr><th>接口名称</th> <th>用途</th> <th>最大时间跨度</th> <th>接口调用地址（必须使用https）</th></tr></thead> <tbody><tr><td>publisher_adpos_general</td> <td>获取小程序广告汇总数据</td> <td>90天</td> <td>https://api.weixin.qq.com/publisher/stat?action=publisher_adpos_general&amp;access_token=ACCESS_TOKEN</td></tr> <tr><td>publisher_adunit_general</td> <td>获取小程序广告细分数据</td> <td>90天</td> <td>https://api.weixin.qq.com/publisher/stat?action=publisher_adunit_general&amp;access_token=ACCESS_TOKEN</td></tr> <tr><td>get_adunit_list</td> <td>获取小程序广告位清单</td> <td>无</td> <td>https://api.weixin.qq.com/publisher/stat?action=get_adunit_list&amp;access_token=ACCESS_TOKEN</td></tr> <tr><td>publisher_settlement</td> <td>获取小程序结算收入数据及结算主体信息</td> <td>无</td> <td>https://api.weixin.qq.com/publisher/stat?action=publisher_settlement&amp;access_token=ACCESS_TOKEN</td></tr></tbody></table>

## 接口调用请求说明

### 一、获取小程序广告汇总数据（publisher\_adpos\_general）

需要向相应接口调用地址增加以下GET请求参数：

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">是否必须</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">page</td> <td style="text-align:left">是</td> <td style="text-align:left">返回第几页数据</td></tr> <tr><td style="text-align:left">page_size</td> <td style="text-align:left">是</td> <td style="text-align:left">当页返回数据条数</td></tr> <tr><td style="text-align:left">start_date</td> <td style="text-align:left">是</td> <td style="text-align:left">获取数据的开始时间 yyyy-mm-dd</td></tr> <tr><td style="text-align:left">end_date</td> <td style="text-align:left">是</td> <td style="text-align:left">获取数据的结束时间 yyyy-mm-dd</td></tr> <tr><td style="text-align:left">ad_slot</td> <td style="text-align:left">否</td> <td style="text-align:left">广告位类型名称</td></tr></tbody></table>

**请注意：** 如果不传递广告位类型名称，将默认返回全部类型广告位的数据。

**返回参数说明（publisher\_adpos\_general）**

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">err_msg</td> <td style="text-align:left">返回错误信息</td></tr> <tr><td style="text-align:left">ret</td> <td style="text-align:left">错误码</td></tr> <tr><td style="text-align:left">list: slot_id</td> <td style="text-align:left">广告位类型id</td></tr> <tr><td style="text-align:left">list: ad_slot</td> <td style="text-align:left">广告位类型名称</td></tr> <tr><td style="text-align:left">list: date</td> <td style="text-align:left">日期</td></tr> <tr><td style="text-align:left">list: req_succ_count</td> <td style="text-align:left">拉取量</td></tr> <tr><td style="text-align:left">list: exposure_count</td> <td style="text-align:left">曝光量</td></tr> <tr><td style="text-align:left">list: exposure_rate</td> <td style="text-align:left">曝光率</td></tr> <tr><td style="text-align:left">list: click_count</td> <td style="text-align:left">点击量</td></tr> <tr><td style="text-align:left">list: click_rate</td> <td style="text-align:left">点击率</td></tr> <tr><td style="text-align:left">list: income</td> <td style="text-align:left">收入(分)</td></tr> <tr><td style="text-align:left">list: ecpm</td> <td style="text-align:left">广告千次曝光收益(分)</td></tr> <tr><td style="text-align:left">summary: req_succ_count</td> <td style="text-align:left">总拉取量</td></tr> <tr><td style="text-align:left">summary: exposure_count</td> <td style="text-align:left">总曝光量</td></tr> <tr><td style="text-align:left">summary: exposure_rate</td> <td style="text-align:left">总曝光率</td></tr> <tr><td style="text-align:left">summary: click_count</td> <td style="text-align:left">总点击量</td></tr> <tr><td style="text-align:left">summary: click_rate</td> <td style="text-align:left">总点击率</td></tr> <tr><td style="text-align:left">summary: income</td> <td style="text-align:left">总收入(分)</td></tr> <tr><td style="text-align:left">summary: ecpm</td> <td style="text-align:left">广告千次曝光收益(分)</td></tr> <tr><td style="text-align:left">total_num</td> <td style="text-align:left">list返回总条数</td></tr></tbody></table>

**返回数据包示例（publisher\_adpos\_general）**

```json
{
    "base_resp":{
        "err_msg":"ok",
        "ret":0
    },
    "list":[
        {
            "slot_id":3030046789020061,
            "ad_slot":"SLOT_ID_WEAPP_INTERSTITIAL",
            "date":"2020-04-13",
            "req_succ_count":443610,
            "exposure_count":181814,
            "exposure_rate":0.409850995,
            "click_count":10095,
            "click_rate":0.055523777,
            "income":52175,
            "ecpm":286.969100289
        }
    ],
    "summary":{
        "req_succ_count":4406394,
        "exposure_count":1797225,
        "exposure_rate":0.407867522,
        "click_count":100167,
        "click_rate":0.055734257,
        "income":578003,
        "ecpm":321.608591022
    },
    "total_num":1
}
```

### 二、获取小程序广告细分数据（publisher\_adunit\_general）

需要向相应接口调用地址增加以下GET请求参数：

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">是否必须</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">page</td> <td style="text-align:left">是</td> <td style="text-align:left">返回第几页数据</td></tr> <tr><td style="text-align:left">page_size</td> <td style="text-align:left">是</td> <td style="text-align:left">当页返回数据条数</td></tr> <tr><td style="text-align:left">start_date</td> <td style="text-align:left">是</td> <td style="text-align:left">获取数据的起始日期 yyyy-mm-dd</td></tr> <tr><td style="text-align:left">end_date</td> <td style="text-align:left">是</td> <td style="text-align:left">获取数据的结束时间 yyyy-mm-dd</td></tr> <tr><td style="text-align:left">ad_slot</td> <td style="text-align:left">否</td> <td style="text-align:left">广告位类型名称</td></tr> <tr><td style="text-align:left">ad_unit_id</td> <td style="text-align:left">否</td> <td style="text-align:left">广告位id</td></tr></tbody></table>

**请注意：** 当需要获取全部广告位的细分数据时，无需传递广告位类型名称及广告位id；当需要获取某类型广告位的细分数据时，仅需传递广告位类型名称；当需要获取某广告位id的细分数据时，仅需传递广告位id。

**返回参数说明（publisher\_adunit\_general）**

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">err_msg</td> <td style="text-align:left">返回错误信息</td></tr> <tr><td style="text-align:left">ret</td> <td style="text-align:left">错误码</td></tr> <tr><td style="text-align:left">list: ad_unit_id</td> <td style="text-align:left">广告位id</td></tr> <tr><td style="text-align:left">list: ad_unit_name</td> <td style="text-align:left">广告位名称</td></tr> <tr><td style="text-align:left">list: stat_item: ad_slot</td> <td style="text-align:left">广告位类型名称</td></tr> <tr><td style="text-align:left">list: stat_item :date</td> <td style="text-align:left">数据日期</td></tr> <tr><td style="text-align:left">list: stat_item :req_succ_count</td> <td style="text-align:left">拉取量</td></tr> <tr><td style="text-align:left">list: stat_item :exposure_count</td> <td style="text-align:left">曝光量</td></tr> <tr><td style="text-align:left">list: stat_item: exposure_rate</td> <td style="text-align:left">曝光率</td></tr> <tr><td style="text-align:left">list: stat_item :click_count</td> <td style="text-align:left">点击量</td></tr> <tr><td style="text-align:left">list: stat_item :click_rate</td> <td style="text-align:left">点击率</td></tr> <tr><td style="text-align:left">list: stat_item :income</td> <td style="text-align:left">收入</td></tr> <tr><td style="text-align:left">list: stat_item :ecpm</td> <td style="text-align:left">广告千次曝光收益(分)</td></tr> <tr><td style="text-align:left">total_num</td> <td style="text-align:left">请求返回总数</td></tr></tbody></table>

**返回数据包示例（publisher\_adunit\_general）**

```json
{
    "base_resp":{
        "err_msg":"ok",
        "ret":0
    },
    "list":[
        {
            "ad_unit_id":"adunit-9cedd8514XXXX",
            "ad_unit_name":"激励视频长广告",
            "stat_item":{
                "ad_slot":"SLOT_ID_WEAPP_REWARD_VIDEO",
                "date":"2020-04-10",
                "req_succ_count":138250,
                "exposure_count":74771,
                "exposure_rate":0.54083906,
                "click_count":2242,
                "click_rate":0.029984887,
                "income":93883,
                "ecpm":6.790813743
            }
        }
    ],
    "total_num":1
}
```

### 三、获取小程序广告位清单（get\_adunit\_list）

需要向相应接口调用地址增加以下GET请求参数：

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">是否必须</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">page</td> <td style="text-align:left">是</td> <td style="text-align:left">返回第几页数据</td></tr> <tr><td style="text-align:left">page_size</td> <td style="text-align:left">是</td> <td style="text-align:left">当页返回数据条数</td></tr> <tr><td style="text-align:left">ad_slot</td> <td style="text-align:left">否</td> <td style="text-align:left">广告位类型名称</td></tr> <tr><td style="text-align:left">ad_unit_id</td> <td style="text-align:left">否</td> <td style="text-align:left">广告位id</td></tr></tbody></table>

**请注意：** 当需要获取全部广告位的清单时，无需传递广告位类型名称及广告位id；当需要获取某类型广告位的清单时，仅需传递广告位类型名称；当需要获取某广告位id的数据时，仅需传递广告位id。

**返回参数说明（get\_adunit\_list）**

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">err_msg</td> <td style="text-align:left">返回错误信息</td></tr> <tr><td style="text-align:left">ret</td> <td style="text-align:left">错误码</td></tr> <tr><td style="text-align:left">ad_slot</td> <td style="text-align:left">广告位类型名称</td></tr> <tr><td style="text-align:left">ad_unit_id</td> <td style="text-align:left">广告位ID</td></tr> <tr><td style="text-align:left">ad_unit_name</td> <td style="text-align:left">广告位名称</td></tr> <tr><td style="text-align:left">ad_unit_size</td> <td style="text-align:left">广告位尺寸</td></tr> <tr><td style="text-align:left">ad_unit_status</td> <td style="text-align:left">广告位状态</td></tr></tbody></table>

**返回数据包示例（get\_adunit\_list）**

```json
{
    "base_resp":{
        "err_msg":"ok",
        "ret":0
    },
    "ad_unit":[
        {
            "ad_slot":"SLOT_ID_WEAPP_REWARD_VIDEO",
            "ad_unit_id":"adunit-e9418ee19XXXXX",
            "ad_unit_name":"rewaXXXX",
            "ad_unit_size":[
                {
                    "height":166,
                    "width":582
                }
            ],
            "ad_unit_status":"AD_UNIT_STATUS_ON",
            "ad_unit_type":"AD_UNIT_TYPE_REWARED_VIDEO",
            "appid":"wx0afc78670fXXXX",
            "video_duration_max":30,
            "video_duration_min":6
        }
    ],
    "total_num":1
}
```

### 四、获取小程序结算收入数据及结算主体信息（publisher\_settlement）

需要向相应接口调用地址增加以下GET请求参数：

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">是否必须</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">page</td> <td style="text-align:left">是</td> <td style="text-align:left">数据返回页数</td></tr> <tr><td style="text-align:left">page_size</td> <td style="text-align:left">是</td> <td style="text-align:left">每页返回数据条数</td></tr> <tr><td style="text-align:left">start_date</td> <td style="text-align:left">是</td> <td style="text-align:left">获取数据的开始时间 yyyy-mm-dd</td></tr> <tr><td style="text-align:left">end_date</td> <td style="text-align:left">是</td> <td style="text-align:left">获取数据的结束时间 yyyy-mm-dd</td></tr></tbody></table>

**请注意：** 只要与获取数据的起止时间有重合，结算区间对应的数据都将返回。例如，请求2月11日至3月26日的数据，将会返回2月上半月、2月下半月、3月上半月、3月下半月四个结算区间的数据。

**返回参数说明（publisher\_settlement）**

<table><thead><tr><th style="text-align:left">参数</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">err_msg</td> <td style="text-align:left">返回错误信息</td></tr> <tr><td style="text-align:left">ret</td> <td style="text-align:left">错误码</td></tr> <tr><td style="text-align:left">body</td> <td style="text-align:left">主体名称</td></tr> <tr><td style="text-align:left">revenue_all</td> <td style="text-align:left">累计收入</td></tr> <tr><td style="text-align:left">penalty_all</td> <td style="text-align:left">扣除金额</td></tr> <tr><td style="text-align:left">settled_revenue_all</td> <td style="text-align:left">已结算金额</td></tr> <tr><td style="text-align:left">settlement_list: date</td> <td style="text-align:left">数据更新时间</td></tr> <tr><td style="text-align:left">settlement_list: zone</td> <td style="text-align:left">日期区间</td></tr> <tr><td style="text-align:left">settlement_list: month</td> <td style="text-align:left">收入月份</td></tr> <tr><td style="text-align:left">settlement_list: order</td> <td style="text-align:left">1 = 上半月，2 = 下半月</td></tr> <tr><td style="text-align:left">settlement_list: sett_status</td> <td style="text-align:left">1 = 结算中；2、3 = 已结算；4 = 付款中；5 = 已付款</td></tr> <tr><td style="text-align:left">settlement_list: settled_revenue</td> <td style="text-align:left">区间内结算收入</td></tr> <tr><td style="text-align:left">settlement_list: sett_no</td> <td style="text-align:left">结算单编号</td></tr> <tr><td style="text-align:left">settlement_list: mail_send_cnt</td> <td style="text-align:left">申请补发结算单次数</td></tr> <tr><td style="text-align:left">settlement_list: slot_revenue: slot_id</td> <td style="text-align:left">产生收入的广告位</td></tr> <tr><td style="text-align:left">settlement_list: slot_revenue: slot_settled_revenue</td> <td style="text-align:left">该广告位结算金额</td></tr> <tr><td style="text-align:left">total_num</td> <td style="text-align:left">请求返回总条数</td></tr></tbody></table>

**返回数据包示例（publisher\_settlement）**

```json
{
    "base_resp":{
        "err_msg":"ok",
        "ret":0
    },
    "body":"深圳市腾讯计算机系统有限公司",
    "penalty_all":0,
    "revenue_all":5178368698,
    "settled_revenue_all":2613696765,
    "settlement_list":[
        {
            "date":"2020-03-25",
            "zone":"2020年3月1日至15日"
            "month":"202003",
            "order":1,
            "sett_status":1,
            "settled_revenue":718926045,
            "sett_no":"XXX",
            "mail_send_cnt":"0",
            "slot_revenue":[
                {
                    "slot_id":"SLOT_ID_WEAPP_BANNER",
                    "slot_settled_revenue":34139443
                },
                {
                    "slot_id":"SLOT_ID_WEAPP_REWARD_VIDEO",
                    "slot_settled_revenue":684786602
                }
            ]
        }
    ],
    "total_num":1
}
```

## 错误码说明

<table><thead><tr><th>错误码返回值</th> <th>含义</th></tr></thead> <tbody><tr><td>45009</td> <td>请求过于频繁, 请稍后尝试</td></tr> <tr><td>45010</td> <td>无效的接口名</td></tr> <tr><td>1701</td> <td>参数错误</td></tr> <tr><td>2009</td> <td>无效的流量主</td></tr></tbody></table>
