# EarthOnline（地球Online）

## 提交身份（对整个仓库、所有子项目一律生效）

本仓库的每一条 commit 都必须以仓库主人的身份提交，而不是 Claude：

```
user.name  = Cindy_wxd
user.email = 209322477+Cinnnnnnndy@users.noreply.github.com
```

`.claude/hooks/set-git-identity.sh` 会在每次会话开始时自动把这两项写进
`.git/config`（仓库级配置优先于云端沙箱的全局 `~/.gitconfig`，后者写的是
`Claude <noreply@anthropic.com>`）。本机已配好本人身份时该 hook 不会改动它。

**如果那个 hook 因为任何原因没跑到**（hook 被禁用、在别的工具里操作、CI 里提交），
在 commit 之前先手动执行一次：

```bash
git config --local user.name  "Cindy_wxd"
git config --local user.email "209322477+Cinnnnnnndy@users.noreply.github.com"
git config --local commit.gpgsign false
```

提交前用 `git config user.email` 确认一遍；提交后用
`git log -1 --pretty='%an <%ae>'` 复核，出现 `noreply@anthropic.com` 说明配置没生效，
改完要重新提交（`git commit --amend --reset-author`）。

不要在 commit message 里写 `Co-Authored-By: Claude ...` 或 `Claude-Session: ...`
尾注，也不要在 PR 描述里加 Claude Code 的署名——`.claude/settings.json` 里的
`attribution` 已经关掉了它们。

## 版本管理

- **标签**：每发一批改动打一个带说明的标签 `v0.<大>.<小>`（`git tag -a v0.101 <提交> -m "…"`），标签也推上去（`git push origin --tags`）。
  一批里有新功能就进大版本（v0.101 → v0.102），只是修补就进小版本（v0.101 → v0.101.1）。
- **CHANGELOG.md**（仓库根目录）：每个版本一节，中文，一行一个改动，前面写提交的短哈希。打标签时一起更新。
- **一件事一个提交**：提交信息用中文，第一行说清做了什么；只改 iPhone Duo 适配的加前缀「Duo：」。
  不同的事分开提交，别把无关的改动混在一起（还没定下来的改动先留在工作区，不提交）。
- **大功能先开分支**：在分支上做完、在模拟器上验过，再合并回 main。小修补直接在 main 上。
- 提交前跑 `npm run check`（地球Online/app），动了 iOS 再跑 `python3 ios/Support/check_strings.py` 并构建一次。
