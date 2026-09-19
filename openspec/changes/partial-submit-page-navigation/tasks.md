## 1. Paging and navigation

- [x] 1.1 Update page construction tests and implementation so adjacent single-choice questions pair, multi-select questions stand alone, and text questions remain standalone.
- [x] 1.2 Replace section buttons with horizontally scrollable page-number buttons; verify exact-page jumps, active-page visibility, and no document overflow at 320px, 390px, and desktop widths.

## 2. Partial submission

- [x] 2.1 Add failing unit and integration tests for partial validation and a backward-compatible full-save path.
- [x] 2.2 Implement the database migration and persistence adapter so partial saves accept missing required answers but reject malformed or inconsistent supplied answers.
- [x] 2.3 Add `Submit now` beside `Next page`, preserve retry/conflict states, and verify later reload and completion use the same response record.

## 3. Analytics and release verification

- [x] 3.1 Verify partial responses appear in respondent lists and CSV with empty unanswered cells, while question distributions ignore missing answers.
- [x] 3.2 Run unit, integration, browser, OpenSpec, staging, and online smoke tests; clean synthetic data and record evidence.

验证证据：`npm.cmd test` 53/53、`npm.cmd run test:browser` 39/39 通过；真实 Supabase 已应用 004 迁移并登记 001-004；真实 staging 完整回收站 smoke 与部分保存/重新载入/清理均通过；OpenSpec strict 校验通过。完整线上 smoke 尚待下一次发布后执行。

## 4. Navigation placement correction

- [x] 4.1 Place the horizontally scrollable page navigation above the progress bar and center the active page after every jump; verify with the paging browser test.

## 5. Final release corrections

- [x] 5.1 Remove the public partial-submit control so only the final review can submit after all required answers pass validation; verify no `Submit now` control appears.
- [x] 5.2 Correct the page 4 geographic option to `Austria`, synchronize the catalog/tests/database validation, and scan the current question copy for common spelling errors.

验证证据：`npm.cmd run test:browser` 38/38 通过；迁移 `005_correct_question_option.sql` 已应用到真实 Supabase，远端迁移版本为 001–005；目录与当前数据库校验均使用 `Austria`。旧迁移中的 `Australasia` 仅作为历史迁移内容保留，不代表当前可选项。
