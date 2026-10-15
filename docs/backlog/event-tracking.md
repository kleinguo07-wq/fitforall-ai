# 待开发需求池埋点

来源：原 v1.1 P1。状态：待排期，不随当前版本交付。已有同义事件直接沿用，不重复新增；原 eventID 与序号保留，目标版本待未来排期确定。

## P1（11 个事件）

| 序号 | eventID | 事件描述 | key | 属性名说明 | Vaule | 属性值说明 | 其他备注 | 版本号 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 8 | click_mydata_checkin | click_大屏我的数据签到入口 | checkin_state | 点击前入口状态 | {unchecked, checked} | 去签到／已签到 | P1。未签到进入固定舒缓热身 AI 跟练站位流程；已签到打开月历。首页不再展示或上报此入口。 | 待排期 |
| 9 | PV_checkin_calendar | PV_查看月度运动签到日历 | business_month<br>signed_days<br>entry_source | 业务月份<br>该月签到天数<br>发起入口 | YYYY-MM<br>非负整数<br>{mydata, report} | 按上海时区运动结束日去重；大屏数据页／运动报告 | P1。仅实际打开日历记录；关闭回到发起页，不触发签到。 | 待排期 |
| 14 | result_daily_checkin | result_当日签到结算 | checkin_result<br>checkin_source<br>business_date | 签到结果<br>来源<br>业务日期 | {first_success, already_checked, not_eligible}<br>{warmup, other_training}<br>YYYY-MM-DD | 当天首次成功／此前已签／本次不具备资格；热身／其他运动 | P1。服务端结算事件；按用户＋上海时区业务日去重。不能由点击“去签到”触发。重复报告或重试不得新增成功事件。 | 待排期 |
| 15 | PV_training_report_growth | PV_有效运动报告成长卡曝光 | report_type<br>checkin_state | 报告类型<br>当日签到状态 | {single, ai}<br>{first_success, already_checked} | 单项体能／AI 跟练；本次首次签到／当天此前已签到 | P1。仅有效报告实际展示成长卡时发送；无效运动的“本次未计入”不发送。 卡片数值为累计总运动天数、累计总消耗千卡和累计总时长分钟，不是本次数据。 | 待排期 |
| 16 | click_training_report_checkin | click_从报告查看签到记录 | report_type | 报告类型 | {single, ai} | 单项体能／AI 跟练 | P1。点击报告签到记录入口时记录；打开月历。原报告里程碑入口移除，不再发送旧 click_training_report_growth。 | 待排期 |
| 17 | click_mydata_medal | click_小程序里程碑入口 | platform | 终端 | {miniapp} | 小程序 | P1。仅小程序累计卡片奖牌入口点击；大屏奖牌入口移除。 | 待排期 |
| 18 | PV_personal_milestone | PV_浏览个人里程碑 | platform<br>entry_source<br>has_record | 终端<br>进入来源<br>是否已有有效记录 | {miniapp}<br>{mydata}<br>{true, false} | 小程序；我的数据；有记录／零记录 | P1。里程碑仅从小程序我的数据进入，不包含大屏和运动报告来源。 进度条起点始终为 0，首屏只展示下一目标；达到档位后累计值保留，时长按秒换算显示一位小数。 | 待排期 |
| 19 | click_personal_milestone_targets | click_横滑查看后续里程碑目标 | metric_type<br>direction | 指标维度<br>滑动方向 | {duration, kcal, days}<br>{previous, next} | 运动时长／消耗千卡／运动天数；前一组／后一组 | P1。仅小程序里程碑目标列表切换记录；首屏只展示下一目标。 | 待排期 |
| 20 | result_milestone_achieved | result_达成里程碑档位 | metric_type<br>target_value | 指标维度<br>达成档位数值 | {duration, kcal, days}<br>对应已配置档位 | 时长以分钟、热量以千卡、天数以自然日计 | P1。服务端在有效运动结算后按用户＋维度＋档位幂等产生；一次跨多档应分别记录。仅浏览页面不触发。 | 待排期 |
| 30 | PV_mydata_checkin | PV_大屏我的数据签到入口曝光 | checkin_state | 当前签到状态 | {unchecked, checked} | 去签到／已签到 | P1。D08 入口实际展示时记录，服务端状态变化后可新增一次；与事件 8 配对统计点击率。首页和人群页不展示、不上报签到入口。 | 待排期 |
| 31 | PV_mydata_medal | PV_小程序里程碑入口曝光 | platform<br>has_record | 终端<br>是否有有效运动记录 | {miniapp}<br>{true, false} | 小程序；有记录／零记录 | P1。M01 奖牌入口实际展示时记录，与事件 17 配对统计点击率；大屏及运动报告不展示此入口。 | 待排期 |

## 共用事件的后续扩展（不新增同义事件）

| eventID | 待开发内容接入时的变化 |
| --- | --- |
| PV_training_preparation | entry_source 增加 personal_data_checkin；课程 ID 指向固定新制作的舒缓热身内容。 |
| result_training_identity | 复用身份确认结果，entry_source 支持 personal_data_checkin，不另加确认点击。 |
| result_training_start | 正式计时开始时复用原事件，以 personal_data_checkin 区分数据页热身来源。 |
| result_training_settlement | 复用本人与本次运动的结算与去重；未来接入时联动满 10 秒有效方案、签到及累计，不重复发送普通与签到两套事件。 |

## 统计与演示边界

- 业务日按 Asia/Shanghai 的运动结束日期确定；签到按用户与业务日去重；里程碑按用户、维度与档位去重。待同步不能算成永久成功。
- 首页与人群页不新增签到入口；大屏数据页与报告保留方案中的签到入口；里程碑仅来自小程序。
- 需求池的模拟下一天、重放报告、签到状态与里程碑数值等控制不发生产事件。
- 不上传姓名、人脸图像、特征、手机号等；稳定内容 ID 和脱敏会话标识沿用既有规范。
- 完整原始字段及历史说明见 [迁移前埋点快照](source/v1.1-tracking-before-migration.md)。
