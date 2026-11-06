# 横屏v1.0 · 本期埋点需求

更新：2026-11-06

本期需求稿，待研发完成事件映射、接入与生产验收；原型不发送生产埋点

围绕内容发现、启动与逐人记录、单人切水果、视频/排行/查询入口、后台视频分产品及单条公告配置补齐必要采集。下表为24组采集需求，不代表24个全新事件；已知事件优先复用，建议事件名由研发对照正式字典确认。

## 口径与复用依据
- 已只读核对已登记竖屏v1.0快照中的事件定义，并参考现有v1.1埋点方案；横屏/教学屏、后台及小程序的实际事件覆盖仍待各端核对。
- 事件定义或代码存在不代表生产已接收；复用时同时核对含义、触发时机、参数与回执，保留既有eventID拼写（包括PV_catgratepage等历史名称）。

## 公共参数
已有SDK同义字段直接映射，勿重复创建；不适用的条件字段为空，不伪造关联。

| key | 格式/取值 | 含义 |
| --- | --- | --- |
| event_uuid | 唯一值 | 同一采集事实重发沿用，采集平台去重 |
| occurred_at / received_at | 带时区的时间戳 | 发生时间和服务端接收时间分开；按发生时间归属上海自然日，补传不当新发生 |
| requirement_version / app_version | v1.0 / 实际应用构建版本 | 方案版本与实际客户端版本分开 |
| product_type / terminal | fitness_machine或sport_station / screen或admin | 屏端固定sport_station，后台视频按当前目标产品，公告固定sport_station；复用SDK已有同义字段 |
| org_id / site_id / device_id | 正式平台标识，按终端适用 | 沿用授权管理范围；后台无具体设备则device_id为空，不能填模拟值 |
| page_instance_id / from_page | 当前展示实例 / 实际来源页 | 按真实页面进入生成，不因组件重绘改变；结果页刷新不重算运动 |
| attempt_id / session_id / record_id | 条件必填：启动尝试 / 正式运动 / 逐人记录 | 未开始可只有attempt_id；正式运动后带session_id，逐人结算/上报带record_id；再玩新局产生新ID |
| participant_key / analytics_user_key | 条件适用：局内匿名键 / 平台已批准的匿名用户键 | 多人逐人区分，关联前不得猜用户；没有合法稳定用户键时不计算跨场UV。不上报姓名、手机号、人脸图像、特征或账号凭据 |
| content_id / content_type / entry_source | 正式ID / ai或fitness或game或video / 实际入口 | 沿用正式ID和已有码表，不用原型临时键作生产ID；非内容事件允许空 |
| env / is_demo | production或test / true或false | 生产看板排除测试与演示。公开评审原型完全不调用生产埋点 |

## 本期采集清单

### LS-T01 首页浏览

- 端与环节：屏端 / 内容发现；本期必要
- eventID：`PV_homepage`
- 复用状态：旧屏端快照已见定义；沿用原eventID和已有字段，补横屏产品维度；横屏/教学屏接入及线上接收待核验
- 触发：首页实际可见时发送；从其他页真实返回可生成新的page_instance_id，组件重绘不新发。
- 去重：同一page_instance_id一次；自动推荐轮换、时钟更新不再发送首页PV。

| key | 取值 | 说明 |
| --- | --- | --- |
| page_instance_id | 唯一值 | 一次实际首页展示 |
| entry_source | startup / module_nav / back / idle_return | 进入来源，idle_return只在实际存在该流程时用 |

### LS-T02 目录浏览

- 端与环节：屏端 / 内容发现；本期必要
- eventID：`PV_coach_list / PV_training_list / PV_game_list / PV_watch_learn_list`
- 复用状态：旧屏端快照已见定义；沿用原eventID和已有字段，补横屏产品维度；横屏/教学屏接入及线上接收待核验
- 触发：对应AI跟练/体能/趣味/视频目录实际可见后发送当前模块事件。
- 去重：一次目录展示只报当前模块对应事件，不额外叠加通用列表PV；筛选重绘不重复PV。

| key | 取值 | 说明 |
| --- | --- | --- |
| module | ai / fitness / game / video | 对应内容模块 |
| category_id | 正式分类ID / 空 | 当前分类 |
| data_state | ready / empty / failed | 列表数据状态 |

### LS-T03 模块与服务入口点击

- 端与环节：屏端 / 内容发现；本期必要
- eventID：`click_homepage_function`
- 复用状态：旧屏端快照已见定义；沿用原eventID和已有字段，补横屏产品维度；横屏/教学屏接入及线上接收待核验
- 触发：用户真实点击模块导航、全部课程/视频、今日运动榜或查询入口。
- 去重：每次有效点击一次；自动导航或组件渲染不伪造点击。

| key | 取值 | 说明 |
| --- | --- | --- |
| target | home / ai / fitness / video / game / board / rankings / records | 目标功能 |
| entry_position | module_dock / home_title / all_content | 入口位置 |
| from_page | 实际页面标识 | 点击来源 |

### LS-T04 推荐内容实际曝光

- 端与环节：屏端 / 内容发现；本期必要
- eventID：`PV_landscape_recommendation`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：首页推荐课程、推荐视频或轮换按钮中的内容实际可见后发送；自动轮换仅记新曝光。
- 去重：page_instance_id＋推荐区＋位置＋展示批次一次；页面隐藏不曝光；重复样式刷新不增曝光。

| key | 取值 | 说明 |
| --- | --- | --- |
| content_id | 正式内容ID | 被展示内容 |
| entry_position | home_course / home_video / home_quick | 推荐区 |
| position | 从1起整数 | 区内位置 |
| recommendation_batch_id | 本次展示批次 | 轮换前后区分 |
| switch_reason | initial / auto | 首次或自动换组 |

### LS-T05 内容选择

- 端与环节：屏端 / 内容发现；本期必要
- eventID：`click_coach_item / click_training_item / click_game_item / click_watch_learn_item`
- 复用状态：旧屏端快照已见定义；沿用原eventID和已有字段，补横屏产品维度；横屏/教学屏接入及线上接收待核验
- 触发：点击具体内容并锁定目标ID时发送对应模块已有点击事件。
- 去重：一次实际点击只发送对应模块的一条事件；不同时再报通用内容点击。

| key | 取值 | 说明 |
| --- | --- | --- |
| content_id | 正式内容ID | 保留旧item等属性并补稳定ID |
| content_type | ai / fitness / game / video | 内容类型 |
| entry_position | home_course / home_video / home_quick / catalogue | 入口位置 |
| position | 从1起整数 / 空 | 展示位置 |
| recommendation_batch_id | 曝光批次 / 空 | 推荐点击关联T04 |

### LS-T06 内容详情浏览

- 端与环节：屏端 / 内容发现；本期必要
- eventID：`PV_landscape_content_detail`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：详情/玩法说明实际可见后发送，返回后重新可见可新建展示实例。
- 去重：page_instance_id一次；单人/多人或章节选项变化不重复详情PV，最终选项随开始点击上报。

| key | 取值 | 说明 |
| --- | --- | --- |
| content_id | 正式内容ID | 详情对象 |
| content_type | ai / fitness / game / video | 内容类型 |
| mode | single / multi / watch | 当前模式 |
| chapter_id | 正式分节ID / full / 空 | 整套、分节或不适用 |

### LS-T07 详情开始点击

- 端与环节：屏端 / 运动链路；本期必要
- eventID：`click_coach_details_start / click_game_details_start；体能缺口建议click_landscape_training_start`
- 复用状态：旧屏端快照已见定义；沿用原eventID和已有字段，补横屏产品维度；横屏/教学屏接入及线上接收待核验；体能正式开始点击事件映射需核对
- 触发：点击详情主操作并接受启动请求时发送；生成本次attempt_id。视频观看不使用该事件。
- 去重：同一次启动请求一次，连点不新建多次attempt；此事件不算正式运动开始。

| key | 取值 | 说明 |
| --- | --- | --- |
| attempt_id | 本次启动尝试唯一值 | 从准备到正式开始/退出贯通 |
| content_id | 正式内容ID | 运动对象 |
| mode | single / multi | 所选模式 |
| chapter_id | 正式分节ID / full / 空 | 当前内容选择 |
| entry_source | detail / result_replay | 正常或再玩 |

### LS-T08 准备流程到达

- 端与环节：屏端 / 运动链路；本期必要
- eventID：`PV_training_preparation`
- 复用状态：跨产品复用候选，沿用已有v1.1方案命名；不是已实现证明，需核对教学屏真实事件及覆盖
- 触发：实际进入既有站位/身份流程时发送；屏端原型未画过程不影响真实接入时采集。
- 去重：attempt_id一次；准备页重绘不新增；在此退出仍保留到达事实，不生成开始事件。

| key | 取值 | 说明 |
| --- | --- | --- |
| attempt_id | 同T07 | 启动尝试 |
| expected_participants | 正整数 | 当前项目实际配置人数，不预设8人 |
| content_id | 正式内容ID | 当前项目 |

### LS-T09 逐人身份关联结果

- 端与环节：屏端 / 运动链路；本期必要
- eventID：`result_training_identity`
- 复用状态：跨产品复用候选，沿用已有v1.1方案命名；不是已实现证明，需核对教学屏真实事件及覆盖
- 触发：人脸登录/新用户注册/本次身份关联返回明确结果时发送，不以识别框出现作为成功。
- 去重：每个身份请求最终结果一次；重复回调去重；多人分别记录，不按整个场次吞掉第二人。

| key | 取值 | 说明 |
| --- | --- | --- |
| attempt_id | 同T07 | 本次准备流程 |
| participant_key | 本次尝试内的匿名参与者键 | 区分多人及换人，非人脸特征 |
| identity_method | existing_face / new_registration | 已有账号或新注册 |
| result | matched / registered / failed / cancelled | 业务结果 |
| error_code | 规范错误码 / 空 | 失败分类 |
| identity_attempt_id | 本次身份请求标识 | 区分用户重试 |

### LS-T10 正式运动开始

- 端与环节：屏端 / 运动链路；本期必要
- eventID：`result_training_start`
- 复用状态：跨产品复用候选，沿用已有v1.1方案命名；不是已实现证明，需核对教学屏真实事件及覆盖
- 触发：身份与项目条件满足、运动实际计时开始时发送；倒计时、预览和开始按钮点击均不触发。
- 去重：session_id一次。多人同场开始为一场；逐人结果在T12统计，不把同场人数计为多场。

| key | 取值 | 说明 |
| --- | --- | --- |
| attempt_id | 同T07 | 关联启动转化 |
| session_id | 正式运动会话ID | 一局唯一，原接口已有字段优先映射 |
| participant_count | 正整数 | 实际开始人数 |
| content_id | 正式内容ID | 运动对象 |
| mode | single / multi | 实际模式 |

### LS-T11 暂停与恢复

- 端与环节：屏端 / 运动链路；本期必要
- eventID：`change_landscape_training_state`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：实际从运动中变为暂停、或从暂停恢复运动时发送。
- 去重：session_id＋transition_seq一次；持续离区/连续识别帧不反复发送暂停。

| key | 取值 | 说明 |
| --- | --- | --- |
| session_id | 同T10 | 正式会话 |
| state | paused / running | 变化后状态 |
| reason | manual / participant_lost / system / resumed | 状态原因 |
| transition_seq | 从1起状态序次 | 区分真实状态变化 |

### LS-T12 逐人运动结算

- 端与环节：业务结算 / 运动链路；本期必要
- eventID：`result_training_settlement`
- 复用状态：跨产品复用候选，沿用已有v1.1方案命名；不是已实现证明，需核对教学屏真实事件及覆盖
- 触发：业务模块完成该参与者本局结算时发送；待同步也可记录结算事实，不能冒充服务端入库成功。
- 去重：record_id一次，由唯一业务责任方产生；重复退出/结果页刷新不再次结算。只有服务端确认accepted记录进入已保存/排行统计。

| key | 取值 | 说明 |
| --- | --- | --- |
| session_id | 同T10 | 正式会话 |
| record_id | 稳定业务记录ID | 跨重试不变 |
| participant_key | 本局匿名参与者键 | 逐人区分 |
| end_reason | normal / early_exit / interrupted | 正常、主动提前结束、系统中断 |
| effective_duration_seconds | 非负数，秒 | 按项目有效片段，暂停/离区不计 |
| is_valid | true / false | 沿用正式项目有效规则，不新增统一时长阈值 |
| sync_state | accepted / pending / failed | 当前记录上报状态 |

### LS-T13 记录上报结果

- 端与环节：业务上报 / 运动链路；本期必要
- eventID：`result_landscape_record_upload`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条；既有result_offline_training_sync仅用于已覆盖的离线补传，不强行当全量首报
- 触发：正常首报或重试获得明确回执后发送；失败与成功分别记录状态，不能重算运动成绩。
- 去重：upload_attempt_id一次；服务端接受记录按record_id去重，多次accepted只算一条保存成功。待同步不算成功，网络超时归failed并允许重试。

| key | 取值 | 说明 |
| --- | --- | --- |
| record_id | 同T12 | 单个参与者本局记录 |
| upload_attempt_id | 一次请求唯一值 | 标识首报/重试 |
| attempt_type | initial / retry | 上报类型 |
| result | accepted / failed / pending | 服务器接受、失败、明确待处理 |
| retry_count | 非负整数 | 重试次数 |
| error_code | 规范错误码 / 空 | 失败分类 |

### LS-T14 单人切水果本局汇总

- 端与环节：屏端 / 切水果；本期必要
- eventID：`result_landscape_fruit_round`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：本局结束并形成最终游戏统计时发送，不按每个果实或每帧发送业务事件。
- 去重：record_id一次，仅补玩法分析，不再增加运动次数或时长。汇总应满足spawned=hit+miss+remaining，center_hit<=hit；计分/窗口用正式规则，不固化专项评审稿数值。

| key | 取值 | 说明 |
| --- | --- | --- |
| session_id | 同T10 | 本局会话 |
| record_id | 同T12 | 玩家记录 |
| spawned_count | 非负整数 | 实际出果数 |
| hit_count | 非负整数 | 实际切中果数，单果一次 |
| miss_count | 非负整数 | 到期未切中的果数 |
| remaining_count | 非负整数 | 提前结束时仍在场未判定的果数 |
| center_hit_count | 非负整数 | 符合正式规则的果心命中 |
| combo_count | 非负整数 | 符合正式规则的连切组数 |
| max_combo_size | 非负整数 | 最大单组果数 |
| score | 非负数 | 正式计分结果 |
| rule_version | 当前游戏规则版本 | 区分正式参数变化 |

### LS-T15 运动视频播放结果

- 端与环节：屏端 / 视频与服务；本期必要
- eventID：`result_landscape_video_playback`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：一次实际播放以结束、离开或播放失败闭合时发送，暂停不新建播放会话。
- 去重：playback_id一次，加载失败也闭合；纯观看不产生T10/T12及有效运动时长。

| key | 取值 | 说明 |
| --- | --- | --- |
| playback_id | 唯一播放会话 | 重播生成新ID |
| content_id | 正式视频ID | 播放对象 |
| end_reason | ended / exit / failed | 完成、离开或失败 |
| watched_seconds | 非负数，秒 | 真实播放时长，不含暂停 |
| error_code | 规范错误码 / 空 | 失败原因 |

### LS-T16 完整排行榜查看

- 端与环节：屏端 / 视频与服务；本期必要
- eventID：`PV_landscape_rankings`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：完整榜内容区域实际展示后发送，默认运动时长榜；本站服务前8预览不当完整榜。
- 去重：page_instance_id＋metric首次展示一次；同页反复切回同维度不重复PV，真实切换行为由T17记录。不采集榜单昵称或名单。

| key | 取值 | 说明 |
| --- | --- | --- |
| metric | duration / calories | 当前维度 |
| data_state | ready / empty / failed | 数据状态 |
| entry_source | home_title / board | 从首页或服务预览进入 |

### LS-T17 排行榜切换

- 端与环节：屏端 / 视频与服务；本期必要
- eventID：`click_ranking_filter`
- 复用状态：旧屏端快照已见定义；沿用原eventID和已有字段，补横屏产品维度；横屏/教学屏接入及线上接收待核验
- 触发：用户将时长榜切换为消耗榜或反向切换且选择实际改变时发送。
- 去重：每次实际变化一次；默认选中及点击当前项不发送，不生成运动记录。

| key | 取值 | 说明 |
| --- | --- | --- |
| metric | duration / calories | 切换目标维度 |
| from_metric | duration / calories | 切换前维度 |

### LS-T18 记录查询码展示

- 端与环节：屏端 / 视频与服务；本期必要
- eventID：`PV_landscape_record_qr`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：本站服务、查询页或趣味结果页的通用码实际可见时发送。
- 去重：page_instance_id＋qr_location一次；这里只能证明展示，不能推算扫码、本人查询成功或记录保存。小程序已有查询事件可复用补来源，不新增领取流程。

| key | 取值 | 说明 |
| --- | --- | --- |
| qr_location | board / records / game_result | 展示位置 |
| code_state | ready / failed | 正式码可用状态 |
| session_id | 运动会话ID / 空 | 仅本局结果页关联，不携带可代领记录 |

### LS-T19 视频管理页面浏览

- 端与环节：管理后台 / 后台视频；本期必要
- eventID：`PV_admin_video_management`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：后台运动视频管理页面实际进入时发送，初次默认AI全民健身机。
- 去重：page_instance_id一次；初次默认产品不再报产品切换事件。

| key | 取值 | 说明 |
| --- | --- | --- |
| selected_product | fitness_machine / sport_station | 当前产品 |
| list_status | published / draft | 当前列表状态 |

### LS-T20 产品或状态切换

- 端与环节：管理后台 / 后台视频；本期必要
- eventID：`change_admin_video_scope`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：用户改变产品Tab或已发布/草稿箱Tab时发送。
- 去重：一次实际变化一次；产品切换引发状态自动重置不额外报一次用户状态点击。

| key | 取值 | 说明 |
| --- | --- | --- |
| changed_field | product / list_status | 实际变化字段 |
| selected_product | fitness_machine / sport_station | 变化后产品 |
| list_status | published / draft | 变化后状态 |

### LS-T21 视频管理操作结果

- 端与环节：管理后台 / 后台视频；本期必要
- eventID：`result_admin_video_operation`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：上传/编辑操作结束返回明确结果时发送，管理范围与视频属于当前选定产品。
- 去重：operation_id＋最终结果一次；保存成功以接口回执为准。按钮点击不算上传成功，不采集视频文件名、标题、地址或内容。

| key | 取值 | 说明 |
| --- | --- | --- |
| operation_id | 一次业务操作ID | 关联尝试和最终结果 |
| operation | upload / edit | 操作类型 |
| target_product | fitness_machine / sport_station | 实际提交目标 |
| content_id | 正式视频ID / 空 | 成功后返回ID，失败无ID允许空 |
| result | success / validation_failed / request_failed / cancelled | 实际结果 |
| error_code | 规范错误码 / 空 | 失败分类 |

### LS-T22 公告设置查看

- 端与环节：管理后台 / 后台公告；本期必要
- eventID：`PV_admin_notice_settings`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：公告设置页面实际进入且读取到当前保存状态时发送。
- 去重：page_instance_id一次；输入、预览或表单渲染不发送展示成功事件。

| key | 取值 | 说明 |
| --- | --- | --- |
| target_product | sport_station | 固定运动站 |
| saved_state | none / visible / hidden / failed | 无公告、展示中、已隐藏或读取失败 |

### LS-T23 公告保存与显隐结果

- 端与环节：管理后台 / 后台公告；本期必要
- eventID：`result_admin_notice_operation`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：创建/编辑/隐藏/重新展示获得明确结果时发送；前端校验失败也可反馈结果。
- 去重：operation_id＋最终结果一次；成功仅代表后台保存，不等于设备已收到或已展示；输入/预览不记保存。

| key | 取值 | 说明 |
| --- | --- | --- |
| operation_id | 一次操作ID | 连点复用同一次请求 |
| operation | create / update / hide / show | 操作类型 |
| target_product | sport_station | 固定运动站 |
| result | success / validation_failed / request_failed | 保存结果 |
| notice_revision | 成功回执版本 / 空 | 失败为空，不采集内容 |
| error_code | 规范错误码 / 空 | 失败分类 |

### LS-T24 公告配置应用结果

- 端与环节：屏端配置 / 后台公告；本期必要
- eventID：`result_landscape_notice_apply`
- 复用状态：建议事件名；先核对横屏/教学屏/后台字典，已有同义事件直接复用，不同时上报两条
- 触发：运动站收到当前范围公告配置并应用为单条显示或隐藏后发送。
- 去重：device_id＋notice_revision＋result状态一次；普通刷新、每轮滚动不重复发送。无公告二级页PV及公告点击；后台保存成功不能替代该事件。

| key | 取值 | 说明 |
| --- | --- | --- |
| notice_revision | 正式配置版本 | 与T23成功版本关联 |
| display_state | visible / hidden | 目标状态 |
| result | applied / failed | 实际应用结果 |
| error_code | 规范错误码 / 空 | 失败原因 |

## 指标口径

- **首页内容入口点击率**：同一首页page_instance_id发生至少一次T05的展示数 ÷ T01首页展示数；按相同来源、设备与时间口径。推荐单项CTR用T04曝光批次、位置关联T05，不用自动轮换次数当用户点击。

- **运动启动转化率**：产生T10的去重attempt_id ÷ T08准备到达attempt_id；开始按钮点击T07单列，不能当正式开始。

- **身份关联成功率**：按identity_attempt_id统计matched或registered数 ÷ 明确返回结果的身份请求数；cancelled、failed及各方法分开，未返回的请求不能当失败或成功。

- **已闭合运动正常结束率**：同一批已开始且已闭合session_id中end_reason=normal的场次数 ÷ 已闭合场次数；进行中与无法闭合的场次另列，不直接判完成。按场次与按参与人次分别看，不能混算。

- **运动记录上报成功率**：截至查询时T13至少一次accepted的去重record_id ÷ T12应上报的去重record_id；pending、failed单列，重试不增加分母或运动人次。

- **切水果玩法反馈**：仅对有效闭合的单人局看命中率hit/(hit+miss)、果心比例center_hit/hit、最大连切组与中途退出率；分母为0显示无可计算值。再玩通过T07的result_replay来源统计，不能把这些指标称为满意度或健康效果。

- **后台配置正确性**：视频操作按target_product看上传/编辑结果；公告按operation_id看保存成功率，并按同管理范围notice_revision核对T24设备应用结果。后台保存成功与设备应用成功分别统计。

## 不采集与不推断

- 本期无热身、双人/多人新增趣味项目、公告列表/详情事件，不增加对应采集。已有AI跟练/体能过程复用埋点，不因原型没画过程而漏接或重复建一套。

- 首页推荐自动换组只计曝光，不伪造点击；设备时间、天气刷新、页面重绘不重复PV。

- 不新增逐帧姿态、每个水果命中或公告每轮滚动的高频用户行为事件；玩法只报本局汇总。

- 二维码展示不能推算扫码/小程序登录/查询成功；埋点不代替账号绑定、记录入库、排行授权或成绩事实。

- 原型说明、全屏评审、模拟计时、状态切换与重置不发送生产事件。

- 已有分类、搜索和分页事件继续沿用，不因本次入口重排新增同义事件；不采集用户输入的搜索原文。

## 联调验收

- 研发逐项填明最终eventID、复用/补字段/新增、产生端及负责人；旧事件同义复用后移除建议事件，不能两套并报。

- 日志按event_uuid核对首次首页、轮换曝光、内容点击、启动尝试、正式开始与返回，组件刷新/自动轮播不重复PV或点击。

- 正常结束、提前退出、暂停/离区、身份失败/取消、多人逐人记录与再玩分别回归，session_id/record_id不串用。

- 模拟重复结束回调、网络超时、离线补传及成功重复回执，结算和record_id保存成功均不重复累计；发生与接收时间可追踪。

- 核对视频观看只计watched_seconds，榜单切换不生成运动；二维码仅展示时没有扫码成功或记录保存事件。

- 后台两产品切换不串数据；公告失败不报成功、显隐只影响运动站、后台保存与设备应用用revision核对，无公告点击和二级页PV。

- 发布前用测试设备走一条完整链路，核对客户端/业务端日志与采集平台实际入库，再确认看板口径；仅页面原型或结构检查通过不算接入验收。

## 责任分工

- 产品/数据：确认各指标、采集需求与最终字典，核对去重后的样本。

- 屏端/教学屏研发：复用首页/列表/运动与身份事件，传递来源及会话关联。

- 游戏研发：按正式规则形成切水果本局汇总。

- 后台/后端研发：视频产品维度、公告操作回执与配置版本；业务记录幂等事实。

- 测试：覆盖异常和重试，核对采集平台可见事件及真实终端效果。

[查看埋点网页](tracking.html)
