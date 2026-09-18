## Purpose

Keep analytics and exports predictable when respondents intentionally save incomplete answers.

## ADDED Requirements

### Requirement: 总体指标
`Overview` SHALL include saved partial responses in `Completed Responses` only when they are persisted response records, while each question-specific metric SHALL use only valid answers for that question as its denominator.

#### Scenario: 部分答卷进入统计
- **WHEN** 一份部分答卷被保存且管理员载入统计
- **THEN** 总答卷数 SHALL include the record, while unanswered questions SHALL not be counted as answers

### Requirement: 安全的 CSV 导出
CSV SHALL include persisted partial responses, leaving unanswered question cells empty while retaining the current 23-question column order.

#### Scenario: 导出部分答卷
- **WHEN** 管理员导出包含部分答卷的数据
- **THEN** CSV SHALL contain the respondent row with empty cells for unanswered questions
