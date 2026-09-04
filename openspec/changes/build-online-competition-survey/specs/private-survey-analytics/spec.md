## Purpose

定义仅供主办方使用的管理体验，用于安全查看问卷总数、选项分布、带署名的开放回答、个人完整答卷和可移植导出文件，以及管理答卷的回收站生命周期。

## ADDED Requirements

### Requirement: 仅限管理员的身份验证
系统 SHALL 为一个预先创建的管理员账号提供邮箱和密码登录，SHALL NOT 提供公开的管理员注册功能，并 SHALL 拒绝未登录或未授权用户访问答卷数据及执行软删除、恢复或永久删除操作。

#### Scenario: 授权管理员登录
- **WHEN** 预先创建的管理员提交有效凭据
- **THEN** 系统 SHALL 建立已验证会话并打开统计后台

#### Scenario: 登录失败
- **WHEN** 用户提交无效凭据
- **THEN** 系统 SHALL 显示通用失败信息，不得泄露该账号是否存在

#### Scenario: 会话过期
- **WHEN** 管理员会话过期或失效
- **THEN** 系统 SHALL 停止加载受保护数据并返回登录界面

#### Scenario: 未授权用户尝试管理回收站
- **WHEN** 匿名用户或未加入管理员允许列表的已登录用户尝试读取回收站或执行删除、恢复、永久删除操作
- **THEN** 系统 SHALL 拒绝该请求且不得修改任何答卷

### Requirement: 后台导航
后台 SHALL 提供 `Overview`、`Choice Questions`、`Open Responses`、`Respondents`、`Deleted Responses` 和 `Export` 视图，并 SHALL 在桌面和移动屏幕上保持可用。`Deleted Responses` SHALL 显示当前回收站记录数量。

#### Scenario: 管理员切换后台视图
- **WHEN** 管理员选择一个后台导航项目
- **THEN** 系统 SHALL 显示对应的受保护结果视图，并且不得修改已保存答卷

### Requirement: 总体指标
`Overview` SHALL 仅基于未删除答卷显示 `Completed Responses`、`Organizations Represented` 和 `Plan to Run Again`，并 SHALL 在界面中提供各指标定义。

#### Scenario: 计算总体指标
- **WHEN** 受保护答卷成功载入
- **THEN** `Completed Responses` SHALL 等于未删除答卷记录数，`Organizations Represented` SHALL 等于未删除答卷中不同标准化单位的数量，`Plan to Run Again` SHALL 等于未删除答卷中问题 2 选择 `Yes` 的人数除以该题有效回答人数

### Requirement: 选择题结果分布
后台 SHALL 仅基于未删除答卷，按选项显示每一道单选题、多选题和评分题的结果分布。每个选项 SHALL 显示回答人数和占比。

#### Scenario: 计算单选题或评分题分布
- **WHEN** 一道单选题或评分题存在有效回答
- **THEN** 每个选项 SHALL 显示选择人数，以及该人数除以该题全部有效回答数所得的比例

#### Scenario: 计算多选题分布
- **WHEN** 一道多选题存在有效回答
- **THEN** 每个选项 SHALL 显示选择该项的填写者人数和占比，并且界面 SHALL 说明各选项比例合计可能超过 100%

#### Scenario: 题目没有有效回答
- **WHEN** 一道题没有任何有效回答
- **THEN** 后台 SHALL 显示 `No responses yet`，而不是绘制具有误导性的百分比图表

### Requirement: 查看带署名的开放回答
后台 SHALL 仅从未删除答卷中，将非空的开放答案和 `Other` 补充说明显示为 `Organization · Name — Answer`，并 SHALL 支持按问题筛选，以及按填写者姓名、单位或回答文字搜索。

#### Scenario: 管理员查看一道开放题
- **WHEN** 管理员选择一道开放题
- **THEN** 后台 SHALL 显示该问题的全部非空回答及填写者署名

#### Scenario: 条件答案当前未激活
- **WHEN** 一条已存条件答案没有被当前前置答案激活
- **THEN** 后台 SHALL 在结果汇总中将其省略

### Requirement: 填写者详情视图
后台 SHALL 在正常 `Respondents` 视图中仅列出未删除填写者及其单位、首次创建时间和最后修改时间，并 SHALL 允许管理员查看一份完整的个人答卷。每条记录 SHALL 提供 `Delete` 操作。

#### Scenario: 管理员打开填写者记录
- **WHEN** 管理员选择一条填写者记录
- **THEN** 后台 SHALL 显示身份信息、时间戳和当前答案，同时避免提供容易误操作的编辑能力

### Requirement: 安全的 CSV 导出
后台 SHALL 将当前未删除答卷数据导出为 UTF-8 CSV，其中包含身份信息、首次创建与最后修改时间，以及每道问卷题目对应的清晰列名。系统 SHALL 对可能被电子表格软件解释为公式的字段值进行安全处理。

#### Scenario: 管理员导出答卷
- **WHEN** 管理员在答卷加载完成后请求 CSV 导出
- **THEN** 浏览器 SHALL 下载包含当前记录且字段已安全转义、可由 Excel 正确打开的 UTF-8 CSV 文件

### Requirement: 受保护数据的异常状态
后台 SHALL 区分加载中、无数据、身份验证失败、网络失败和服务错误状态，并 SHALL NOT 将过期或不完整数据呈现为最新成功结果。

#### Scenario: 无法载入受保护数据
- **WHEN** 已登录请求失败
- **THEN** 后台 SHALL 不得使用新产生的部分数据进行计算，并 SHALL 说明结果无法载入，同时根据情况提供重试或重新登录操作

### Requirement: 答卷回收站生命周期
后台 SHALL 允许管理员将答卷移入回收站、恢复答卷，或在明确确认后永久删除答卷。回收站记录 SHALL 保留原答案、首次创建时间、最后修改时间，并记录删除时间和删除操作者。

#### Scenario: 管理员将答卷移入回收站
- **WHEN** 管理员点击某条答卷的 `Delete`，在显示姓名与单位的确认对话框中选择 `Move to Deleted Responses`
- **THEN** 系统 SHALL 记录删除时间与删除操作者，将该答卷从全部正常视图、统计和 CSV 中排除，并刷新当前后台数据

#### Scenario: 管理员取消软删除
- **WHEN** 管理员在软删除确认对话框中选择 `Cancel` 或按 Escape
- **THEN** 系统 SHALL 关闭对话框、恢复触发按钮焦点且不得修改答卷

#### Scenario: 管理员查看回收站
- **WHEN** 管理员打开 `Deleted Responses`
- **THEN** 后台 SHALL 列出每条回收站记录的姓名、单位、删除时间和删除操作者，并提供 `Restore` 与 `Delete permanently` 操作

#### Scenario: 管理员恢复答卷
- **WHEN** 管理员对一条回收站记录选择 `Restore` 且操作成功
- **THEN** 系统 SHALL 清除该记录的删除状态，使其重新出现在正常视图、统计和 CSV 中

#### Scenario: 永久删除确认不匹配
- **WHEN** 管理员选择 `Delete permanently` 但没有输入与记录完全一致的填写者姓名
- **THEN** 系统 SHALL 保持永久删除按钮禁用并不得修改答卷

#### Scenario: 管理员永久删除答卷
- **WHEN** 管理员输入完全匹配的填写者姓名并确认 `Delete permanently`
- **THEN** 系统 SHALL 永久移除该答卷，使其无法恢复

#### Scenario: 回收站操作失败
- **WHEN** 软删除、恢复或永久删除请求发生网络、权限或服务错误
- **THEN** 后台 SHALL 保留当前记录和统计状态，明确说明操作未成功，并允许管理员重试
