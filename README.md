# AI PR Review

AI 驱动的 GitHub Pull Request 代码审查 Action。兼容任何 **OpenAI 格式**（`/v1/chat/completions`）或 **Anthropic 格式**（`/v1/messages`）的 API。

**支持 fork PR** — 使用 `pull_request_target` + GitHub API 拉取 diff，不 checkout 不可信代码，安全无泄漏。

## 使用

```yaml
name: AI Code Review

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: SleepNap/ai-pr-review@v1
        with:
          api_key: ${{ secrets.AI_API_KEY }}
          api_base: https://api.minimaxi.com        # 你的 API 地址
          api_format: openai                         # openai | anthropic
          model: MiniMax-M3                          # 模型名
          reviewer_name: AI Review
          system_prompt: |
            你是一个资深的代码审查专家。
            请用中文回复，给出结构化的审查意见。
```

## 常用平台参考

| 平台 | `api_base` | `api_format` | 模型示例 |
|------|-----------|-------------|---------|
| MiniMax | `https://api.minimaxi.com` | `openai` | `MiniMax-M3` |
| DeepSeek | `https://api.deepseek.com` | `openai` | `deepseek-v4-flash` |
| OpenAI | `https://api.openai.com` | `openai` | `gpt-5.5` |
| Anthropic | `https://api.anthropic.com` | `anthropic` | `claude-opus-4-8` |
| Groq | `https://api.groq.com` | `openai` | `meta-llama/llama-4-maverick-17b-128e-instruct` |
| 智谱 | `https://open.bigmodel.cn` | `openai` | `glm-5.1` |
| 月之暗面 | `https://api.moonshot.ai` | `openai` | `kimi-k2.6` |

URL 和模型可能随时变化，以各平台最新文档为准。

## 输入参数

| 参数 | 必填 | 默认值 | 说明 |
|------|-----|-------|------|
| `api_key` | 是 | — | API 密钥 |
| `api_base` | 是 | — | API 地址（如 `https://api.minimax.chat`） |
| `model` | 是 | — | 模型名称 |
| `api_format` | 否 | `openai` | `openai` / `anthropic` |
| `system_prompt` | 否 | 见 action.yml | 系统提示词 |
| `reviewer_name` | 否 | `AI Code Review` | 评论标题 |
| `exclude_patterns` | 否 | `*.lock,...` | 排除文件 |
| `max_diff_chars` | 否 | `0`（不限） | diff 最大字符数 |
| `max_tokens` | 否 | `4096` | 最大返回 token |
| `github_token` | 否 | 自动 | GitHub Token |

## 为什么用 pull_request_target？

fork 仓库提交的 PR 在 `pull_request` 事件下**无法访问任何 secrets**（GitHub 官方限制）。`pull_request_target` 以目标仓库上下文运行，可以正常读取 secrets。

本 Action 只通过 GitHub API 获取 PR diff，**不 checkout、不执行 PR 代码**，密钥不会泄漏。

## License

MIT