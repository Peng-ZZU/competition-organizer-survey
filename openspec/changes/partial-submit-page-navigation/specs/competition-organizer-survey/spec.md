## Purpose

Define exact-page navigation and an intentional partial-save path while preserving safe answer validation and later completion of the same response.

## ADDED Requirements

### Requirement: 分章节分页导航和最终检查
身份信息采集页之后，系统 SHALL 按题目顺序分页：同一页最多包含 2 道单选题；每道多选题和每道开放文本题独占一页；评分题可与单选题同页。系统 SHALL 显示可横向滚动的页码导航，导航项只显示页码并跳转到对应页面，不得将多个页面合并成章节导航。系统 SHALL 按页显示进度并允许前后翻页。

#### Scenario: 单选题成组
- **WHEN** 相邻题目均为单选题
- **THEN** 系统 SHALL 将最多两道放在同一页

#### Scenario: 多选题独占页面
- **WHEN** 当前题目为多选题
- **THEN** 系统 SHALL 只在该页显示这一道多选题

#### Scenario: 页码导航滚动
- **WHEN** 填写者在窄屏查看导航
- **THEN** 系统 SHALL 提供可左右滑动的页码栏，且点击页码 SHALL 跳转到对应页面

### Requirement: 必填和条件验证
系统 SHALL 为翻页和完整检查要求当前页可见的必填题；系统 SHALL 为完整提交要求所有当前可见必填题；系统 SHALL 为部分提交允许缺少必填题，但仍拒绝非法选项、错误类型、失效条件答案和缺少已选择 `Other` 的说明。

#### Scenario: 部分提交未完成必填题
- **WHEN** 填写者点击 `Submit now` 且答案缺少当前必填题
- **THEN** 系统 SHALL 保存已填写的合法答案，不得因缺少必填题阻止保存

#### Scenario: 部分提交包含非法答案
- **WHEN** 部分提交包含不在目录中的选项或不匹配的 `Other` 说明
- **THEN** 系统 SHALL 拒绝保存并显示可重试错误

### Requirement: 原子保存和修改
系统 SHALL 允许显式的部分提交保存，并 SHALL 保留同一身份、版本冲突、重试、更新时间和后续重新载入修改行为。

#### Scenario: 提交部分答卷
- **WHEN** 填写者点击 `Submit now` 且服务保存成功
- **THEN** 系统 SHALL 显示保存时间，并允许稍后使用同一身份继续修改

## ADDED Requirements

### Requirement: 公开答卷访问边界
公开载入 SHALL 返回部分提交答卷的已保存答案，但 SHALL 继续限制为准确标准化姓名和单位匹配的一份记录。

#### Scenario: 重新载入部分答卷
- **WHEN** 填写者再次提供相同姓名和单位
- **THEN** 系统 SHALL 载入已保存的部分答案而不伪造未填写答案
