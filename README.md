# AI PR Review

AI 驱动的 GitHub Pull Request 代码审查 Action。兼容任何 **OpenAI 格式**（`/v1/chat/completions`）或 **Anthropic 格式**（`/v1/messages`）的 API。

**支持 fork PR** — 使用 `pull_request_target` + GitHub API 拉取 diff，不 checkout 不可信代码，安全无泄漏。

## 使用

### 方式一：preset（最简，两行搞定）

```yaml
- uses: SleepNap/ai-pr-review@v1
  with:
    api_key: ${{ secrets.AI_API_KEY }}
    provider: minimax
```

`api_base`、`api_format`、`model` 都用 preset 的默认值。

### 方式二：preset + 覆盖（token plan / 代理）

```yaml
- uses: SleepNap/ai-pr-review@v1
  with:
    api_key: ${{ secrets.AI_API_KEY }}
    provider: minimax
    api_base: https://你的代理地址       # 覆盖 preset 的 URL
    model: 你的模型名                     # 覆盖 preset 的模型
```

### 方式三：纯自定义

```yaml
- uses: SleepNap/ai-pr-review@v1
  with:
    api_key: ${{ secrets.AI_API_KEY }}
    api_base: https://你的API地址
    model: 你的模型名
```

## 内置 Preset

| `provider` | 默认 `api_base` | 默认 `api_format` | 默认 `model` |
|------------|----------------|------------------|--------------|
| `minimax` | `https://api.minimaxi.com` | `openai` | `MiniMax-M3` |
| `deepseek` | `https://api.deepseek.com` | `openai` | `deepseek-v4-flash` |
| `openai` | `https://api.openai.com` | `openai` | `gpt-5.5` |
| `anthropic` | `https://api.anthropic.com` | `anthropic` | `claude-opus-4-8` |
| `groq` | `https://api.groq.com` | `openai` | `meta-llama/llama-4-maverick-17b-128e-instruct` |
| `zhipu` | `https://open.bigmodel.cn` | `openai` | `glm-5.1` |
| `moonshot` | `https://api.moonshot.ai` | `openai` | `kimi-k2.6` |

URL 和模型以各平台最新文档为准。所有 preset 默认值都可以通过显式参数覆盖。

## 完整示例

```yaml
name: AI Code Review

on:
  pull_request_target:
    types: [opened, reopened, synchronize]

permissions:
  pull-requests: write

jobs:
  review:
    if: github.event.sender.type != 'Bot'
    runs-on: ubuntu-latest
    steps:
      - uses: SleepNap/ai-pr-review@v1
        with:
          api_key: ${{ secrets.MINIMAX_API_KEY }}
          provider: minimax
          reviewer_name: AI Code Review
          system_prompt: |
            你是一个资深的代码审查专家。
            请用中文回复，给出结构化的审查意见。
```

## 输入参数

| 参数 | 必填 | 默认值 | 说明 |
|------|-----|-------|------|
| `api_key` | 是 | — | API 密钥 |
| `provider` | 否 | — | preset 平台。不填则 `api_base` 和 `model` 必填 |
| `api_base` | 否* | preset 默认 | API 地址。覆盖 preset，或不填 provider 时必填 |
| `api_format` | 否* | preset 默认 | `openai` / `anthropic` |
| `model` | 否* | preset 默认 | 模型名。不填 provider 时必填 |
| `system_prompt` | 否 | 见 action.yml | 系统提示词 |
| `reviewer_name` | 否 | `AI Code Review` | 评论标题 |
| `exclude_patterns` | 否 | `*.lock,...` | 排除文件（逗号分隔） |
| `max_diff_chars` | 否 | `0`（不限） | diff 最大字符数 |
| `max_tokens` | 否 | `4096` | 最大返回 token |
| `github_token` | 否 | 自动 | GitHub Token |

## 为什么用 pull_request_target？

fork 仓库提交的 PR 在 `pull_request` 事件下**无法访问任何 secrets**（GitHub 官方限制）。`pull_request_target` 以目标仓库上下文运行，可以正常读取 secrets。

本 Action 只通过 GitHub API 获取 PR diff，**不 checkout、不执行 PR 代码**，密钥不会泄漏。

## License

MIT