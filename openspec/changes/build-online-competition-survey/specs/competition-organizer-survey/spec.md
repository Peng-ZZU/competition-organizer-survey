## Purpose

定义面向竞赛主办方的公开英文问卷体验，包括身份填写、完成给定问卷、保存答卷，以及日后重新载入和修改答卷。

## ADDED Requirements

### Requirement: 填写者身份识别和隐私说明
系统 SHALL 在显示问卷前要求填写者提供姓名和单位。系统 SHALL 说明身份信息和答案仅用于主办方市场调研，并 SHALL 告知填写者可使用相同身份信息重新载入和修改答卷。

#### Scenario: 填写者使用有效身份信息继续
- **WHEN** 填写者提供非空的姓名和单位并接受隐私说明
- **THEN** 系统 SHALL 对身份信息进行标准化匹配，同时保留其显示形式并打开问卷

#### Scenario: 身份信息不完整
- **WHEN** 姓名或单位任意一项为空
- **THEN** 系统 SHALL 阻止继续操作并指出缺失字段

### Requirement: 问题联系信息
系统 SHALL 在公开问卷页面清晰显示英文联系信息 `Questions? Contact Dr. Song at hui.song@rmit.edu.au.`，并 SHALL 将邮箱呈现为可用的邮件链接。

#### Scenario: 填写者需要帮助
- **WHEN** 填写者查看问卷页面
- **THEN** 系统 SHALL 显示 Dr. Song 的联系信息，并允许填写者通过 `mailto:hui.song@rmit.edu.au` 打开邮件客户端

### Requirement: 载入现有答卷
系统 SHALL 将标准化后的填写者姓名与单位组合视为答卷身份，并 SHALL 为该身份最多保留一份当前答卷。公开载入 SHALL 忽略已移入回收站的答卷。

#### Scenario: 存在匹配答卷
- **WHEN** 填写者输入的姓名和单位与已有标准化身份匹配
- **THEN** 系统 SHALL 载入最新保存的答案、版本号和更新时间以供修改

#### Scenario: 不存在匹配答卷
- **WHEN** 填写者输入的姓名和单位没有匹配的标准化身份
- **THEN** 系统 SHALL 创建一份空白答卷

#### Scenario: 仅存在已删除的匹配答卷
- **WHEN** 填写者输入的姓名和单位只匹配一份回收站答卷
- **THEN** 系统 SHALL 将其视为没有现有答卷并打开空白问卷，不得向公开填写者返回回收站中的旧答案

#### Scenario: 输入格式不同但身份等价
- **WHEN** 身份信息仅在首尾空格、连续内部空格或字母大小写方面不同
- **THEN** 系统 SHALL 将其识别为同一答卷身份

### Requirement: 精简后的英文问卷目录
系统 SHALL 使用以下指定的输入类型和选项展示 23 道英文问题。题目文字和选项标签 SHALL 与下列内容保持一致。编号为显示编号，系统 SHALL 按问卷顺序连续编号，并 SHALL 为每道题保留稳定的内部题目 id；已移除题目的 id 与显示编号 SHALL NOT 被复用。

1. `How many times has this competition been held before this iteration?` — 单选：`0`、`1-2`、`3+`。
2. `Do you plan to run this competition again next year?` — 单选：`Yes`、`No`。
3. `How many submissions did your competition receive?` — 单选：`0`、`1-4`、`5-9`、`10+`。
4. `How many research papers related to your competition were submitted to the conference?` — 单选：`0`、`1-4`、`5-9`、`10+`。
5. `Specify the types of participants you received submissions from` — 多选：`Academic`、`University Student`、`High School Student`、`Industry`、`Other`。
6. `Which geographic areas did participants in your competition come from?` — 多选：`Africa`、`Asia`、`Australasia`、`Europe`、`Latin America`、`North America`、`South America`。
7. `Which of the following did your competition provide?` — 多选：`Framework`、`Sample or Baseline Solutions`、`Reference Paper`、`Tutorial`、`Data`、`Other`。
8. `Are submitted solutions made publicly available?` — 单选：`Yes`、`No`。
9. `How did you advertise your competition?` — 多选：`Newsletter`、`Website`、`Twitter`、`Facebook`、`Mailing List of Previous or Potential Participants`、`Publicity Chairs for Conference`、`Other`。
10. `How did participants present their results?` — 多选：`In-Person Presentation`、`Virtual Presentation`、`Submitted Program for Ranking`、`Other`。
11. `Did you communicate/present/discuss the overall results in public?` — 单选：`Yes`、`No`。
12. `How effective was the logistical support provided by the conference?` — 评分：整数 `1` 至 `5`。
13. `Were there any logistical issues that affected your competition?` — 单选：`Yes`、`No`。
14. `Did the competition meet your expectations?` — 单选：`Yes`、`No`。
15. `Would you participate in this competition again?` — 单选：`Yes`、`No`。
16. `Did you make any new professional connections as a result of this competition?` — 单选：`Yes`、`No`。
17. `Have you used or do you plan to use the outcomes of this competition in your work or studies?` — 单选：`Yes`、`No`。
18. `What were the main strengths of this competition?` — 开放文本，选填。
19. `What areas need improvement?` — 开放文本，选填。
20. `Currently, all competitions are linked to educational purposes. Would you be interested in competitions not related to education?` — 单选：`Yes`、`No`。
21. `What was the biggest challenge in organizing the competition?` — 开放文本，选填。
22. `What support would you like the conference/IEEE CIS to provide?` — 开放文本，选填。
23. `What factors limit your willingness to organize the competition again?` — 开放文本，选填。

#### Scenario: 渲染问卷
- **WHEN** 已识别身份的填写者打开问卷
- **THEN** 系统 SHALL 使用指定的输入类型和选项标签，以英文提供所有适用问题，并按当前目录显示连续编号

#### Scenario: 被移除题目不再出现
- **WHEN** 填写者或管理员查看问卷、统计或导出
- **THEN** 系统 SHALL NOT 显示已移除的候选题目，也不得将其纳入统计、开放回答编号或 CSV 导出列

### Requirement: 分章节分页导航和最终检查
身份信息采集页之后，系统 SHALL 将问卷组织为九个章节：`Basic Information`、`Competition Statistics`、`Participant Demographics`、`Competition Resources`、`Promotion and Visibility`、`Presentation of Results`、`Logistical Support`、`Impact on Professional and Academic Growth` 以及 `Feedback and Suggestions`，并 SHALL 在章节内按题目顺序分页：每页最多 2 道选择类题目（单选、多选、评分），每道开放文本题目独占一页。手机端与电脑端 SHALL 使用同一题目顺序和同一分页规则。系统 SHALL 按页显示进度、允许向前和向后翻页，并 SHALL 提供能够跳回各章节的最终检查页面。

#### Scenario: 填写者浏览问卷
- **WHEN** 填写者完成当前页并继续
- **THEN** 系统 SHALL 保留已输入的值，显示下一页并更新进度

#### Scenario: 答题区域显示进度
- **WHEN** 填写者查看任意答题页
- **THEN** 系统 SHALL 将进度条显示在答题卡顶部、页码和题目之前；窄屏下章节目录 SHALL 位于进度条上方，宽屏下目录 SHALL 保持在左侧

#### Scenario: 单页题目上限
- **WHEN** 填写者查看任意一页
- **THEN** 系统 SHALL 在该页最多显示 2 道选择类题目或 1 道开放文本题目，并且 SHALL NOT 将开放文本题目与选择类题目放在同一页

#### Scenario: 章节导航跳转
- **WHEN** 填写者通过章节导航选择某个章节
- **THEN** 系统 SHALL 显示该章节的第一页，并且不丢失其他页面的答案

#### Scenario: 填写者从最终检查页面返回修改
- **WHEN** 填写者在最终检查页面选择某个章节
- **THEN** 系统 SHALL 返回该章节的第一页，并且不丢失其他章节的答案

### Requirement: 必填和条件验证
系统 SHALL 要求填写者身份、每一道当前可见的单选题、多选题、评分题、条件题以及 `Other` 补充说明均已填写。普通开放文本问题 SHALL 保持选填。

#### Scenario: 缺少必填答案
- **WHEN** 填写者在某个可见必填答案缺失时尝试翻页或提交
- **THEN** 系统 SHALL 停留在当前页或返回包含该题目的页面，指出错误字段并聚焦第一个无效控件

#### Scenario: 选择 Other
- **WHEN** 填写者在多选题中选择 `Other`
- **THEN** 系统 SHALL 显示该问题对应的必填补充说明字段

#### Scenario: 条件触发状态失效
- **WHEN** 填写者修改前置答案，使对应条件题不再适用
- **THEN** 系统 SHALL 隐藏该条件题，并在保存前清除其答案

### Requirement: 草稿恢复
系统 SHALL 在当前浏览器中保留尚未提交的草稿，并 SHALL 仅在服务器确认保存成功或填写者明确丢弃草稿后将其清除。

#### Scenario: 提交前刷新页面
- **WHEN** 页面重新载入且当前身份存在未保存草稿
- **THEN** 系统 SHALL 提供恢复草稿的选项，并且不得声称草稿已经提交

### Requirement: 原子保存和修改
系统 SHALL 按标准化身份原子地创建或更新答卷，防止重复点击生成重复记录，并 SHALL 显示服务器确认的保存时间。

#### Scenario: 首次提交成功
- **WHEN** 新填写者提交一份验证通过的问卷
- **THEN** 系统 SHALL 创建一份答卷，并显示包含保存时间的成功状态

#### Scenario: 已删除身份重新提交
- **WHEN** 一份回收站答卷对应的姓名和单位重新提交验证通过的新答案
- **THEN** 系统 SHALL 原子地重新激活该记录、以新答案替换回收站旧答案、清除删除时间与删除操作者，并显示保存成功状态

#### Scenario: 更新现有答卷成功
- **WHEN** 填写者基于当前记录版本提交一份验证通过的修改
- **THEN** 系统 SHALL 替换已存答案、递增版本号、保留首次创建时间并更新修改时间

#### Scenario: 检测到并发修改
- **WHEN** 数据库中的记录版本在填写者载入后已经变化
- **THEN** 系统 SHALL 拒绝覆盖，并要求填写者重新载入最新答卷

#### Scenario: 保存失败
- **WHEN** 网络或服务错误导致无法确认保存
- **THEN** 系统 SHALL 保留当前答案、明确说明答卷尚未保存并提供重试操作

### Requirement: 公开答卷访问边界
公开问卷 SHALL NOT 暴露通用答卷列表、汇总结果、任意搜索、管理员凭据或高权限服务密钥。在已接受的身份限制下，公开填写者 SHALL 只能请求与其提供的准确标准化姓名和单位相匹配的那一份答卷。

#### Scenario: 未登录访问者请求全部答卷
- **WHEN** 未登录访问者尝试在受控身份操作之外列出或查询答卷
- **THEN** 系统 SHALL 拒绝该请求
