# Competition Organizer Survey

这是一个无需自建服务器的英文在线问卷：GitHub Pages 托管静态页面，Supabase 保存答卷并提供管理员身份验证。公开入口为 `index.html`，私有统计入口为 `admin.html`。

## 1. 环境要求

- Node.js 22 或更高版本（仅用于本地测试；生产网页无需 Node.js）
- 一个 Supabase 项目
- 一个用于发布 GitHub Pages 的 GitHub 仓库

## 2. 创建并配置 Supabase

1. 登录 Supabase，新建一个项目并妥善保存数据库密码。
2. 打开项目的 SQL Editor。
3. 完整复制并执行 `supabase/migrations/001_survey.sql`。
4. 确认 SQL Editor 没有报错，并确认 Table Editor 中出现：
   - `survey_responses`
   - `survey_admins`
5. 在 Authentication → Users 中选择 Add user，创建唯一管理员邮箱和密码。不要在问卷网页中提供注册。
6. 在 Authentication → Providers → Email 中关闭公开的 `Allow new users to sign up`，避免无关用户创建账号。
7. 复制新管理员的 User UID，然后在 SQL Editor 执行：

```sql
insert into public.survey_admins (user_id)
values ('把管理员 User UID 放在这里')
on conflict (user_id) do nothing;
```

8. 在 Project Settings → API（部分新版界面显示为 Connect）找到：
   - Project URL
   - Publishable key 或旧版 `anon` public key
9. 编辑 `assets/js/config.js`：

```js
window.SURVEY_CONFIG = Object.freeze({
  supabaseUrl: "https://你的项目编号.supabase.co",
  supabaseAnonKey: "你的公开 Publishable/anon key",
});
```

公开 Publishable/anon key 可以用于浏览器；权限由数据库 RLS 控制。绝对不要把 `service_role` 或 secret key 写入此文件、HTML 或 GitHub。

公开问卷函数允许匿名提交，因此任何纯静态部署都不能彻底阻止自动垃圾请求。当前实现会限制姓名、单位、答案类型和答卷大小。正式发放期间应监控 Supabase API/数据库用量；如果链接需要面向互联网广泛公开，应另行增加经过服务器验证的 CAPTCHA 或 Supabase Edge Function 限流，而不能只做浏览器端验证码。

## 3. 本地运行

安装开发依赖：

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

启动静态预览：

```powershell
npm.cmd run serve
```

打开：

- 问卷：<http://127.0.0.1:4173/index.html>
- 后台：<http://127.0.0.1:4173/admin.html>

如果 `config.js` 仍是空值，页面会明确显示“尚未配置”，不会假装提交成功。

## 4. 验证管理员权限

配置完成后执行以下人工检查：

1. 使用浏览器无痕窗口打开 `index.html`，确认无法看到答卷列表或统计结果。
2. 提交一份测试答卷，使用相同姓名和单位重新进入，确认能够载入并修改。
3. 直接打开 `admin.html`，确认未登录时只显示登录界面。
4. 使用允许列表中的管理员登录，确认能够看到统计结果。
5. 如果创建了另一个未加入 `survey_admins` 的 Auth 用户，确认其无法读取答卷。
6. 测试完成后删除合成答卷或通过管理后台导出后清理。

## 5. 自动测试

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:browser
```

- 单元测试：问题目录、验证、草稿、提交状态、统计、搜索、CSV 和运行配置。
- 集成测试：在 PGlite 的真实 PostgreSQL/WASM 环境执行迁移，验证唯一约束、原子修改、并发冲突和 RLS。
- 浏览器测试：使用 Playwright 验证问卷、管理员后台、移动端布局和下载。

真实发布前还必须在非生产 Supabase 项目运行双连接 staging 测试。先设置四个仅用于当前 PowerShell 会话的变量，再运行：

```powershell
$env:SURVEY_STAGING_SUPABASE_URL = "https://你的测试项目.supabase.co"
$env:SURVEY_STAGING_SUPABASE_ANON_KEY = "测试项目公开 key"
$env:SURVEY_STAGING_ADMIN_EMAIL = "允许列表内管理员邮箱"
$env:SURVEY_STAGING_ADMIN_PASSWORD = "管理员密码"
npm.cmd run test:staging
```

该测试会真实写入一份带 `Staging Concurrency` 前缀的合成答卷，使用两个独立客户端同时提交，验证一份保存、一份冲突、匿名批量读取失败和管理员读取成功。运行后按命令输出在 Supabase 控制台删除该合成答卷。不要把这四个值写入文件或提交到 GitHub。

## 6. 发布到 GitHub Pages

当前目录最初不是 Git 仓库。准备发布时：

1. 在 GitHub 新建一个空仓库，不要自动添加 README。
2. 在本目录执行：

```powershell
git init
git add .
git commit -m "Build competition organizer survey"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

3. 在 GitHub 仓库 Settings → Pages 中选择 Deploy from a branch。
4. 分支选择 `main`，目录选择 `/ (root)`，保存。
5. 等待部署完成，并分别访问站点根路径和 `/admin.html`。
6. 在 Supabase Authentication → URL Configuration 中把 GitHub Pages 地址设置为 Site URL，并加入允许的 Redirect URLs。

## 7. 日常查看与备份

- 选择题：在后台 `Choice Questions` 查看每个选项的人数与占比。
- 开放题：在 `Open Responses` 按问题、姓名、单位或回答文字筛选。
- 完整备份：在 `Export` 下载 CSV，并保存到主办方受控位置。
- Supabase 控制台可用于数据库管理，但不要向普通填写者共享项目后台权限。

建议在正式发放前导出一次空模板、提交三份合成答卷并再次导出，确认 Excel 中的中文姓名、换行和多选内容均正常。

## 8. 新读者上线检查清单

- [ ] 已成功执行 `001_survey.sql`。
- [ ] 已创建一个 Auth 管理员并写入 `survey_admins`。
- [ ] 已关闭公开 Auth 注册。
- [ ] `config.js` 只包含 Project URL 和公开 Publishable/anon key。
- [ ] 三组自动测试全部通过。
- [ ] 新建答卷、重新载入、修改和并发冲突均已测试。
- [ ] 已在非生产 Supabase 项目运行 `npm.cmd run test:staging`，并删除合成答卷。
- [ ] 未登录用户无法批量读取答卷。
- [ ] 管理员能查看三个总体指标、选择题分布和带署名开放回答。
- [ ] CSV 能在 Excel 中正确打开。
- [ ] GitHub Pages 的问卷和 `/admin.html` 均可访问。
- [ ] Dr. Song 的邮箱链接能够打开邮件客户端。

## 9. 回滚

若发布后出现问题，可先在 GitHub Pages 设置中停止发布，并在 Supabase 中撤销匿名角色执行公开函数的权限。这样可以停止新答卷读写，同时保留已有数据供管理员导出。修复并重新验证后再恢复部署和权限。
