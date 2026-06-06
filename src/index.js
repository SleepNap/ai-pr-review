const core = require("@actions/core");
const github = require("@actions/github");

// 预设平台（provider → api_base + format + model 默认值）
const PRESETS = {
  minimax:      { base: "https://api.minimaxi.com",         format: "openai",    model: "MiniMax-M3" },
  deepseek:     { base: "https://api.deepseek.com",          format: "openai",    model: "deepseek-v4-flash" },
  openai:       { base: "https://api.openai.com",            format: "openai",    model: "gpt-5.5" },
  anthropic:    { base: "https://api.anthropic.com",         format: "anthropic", model: "claude-opus-4-8" },
  groq:         { base: "https://api.groq.com",              format: "openai",    model: "meta-llama/llama-4-maverick-17b-128e-instruct" },
  zhipu:        { base: "https://open.bigmodel.cn",         format: "openai",    model: "glm-5.1" },
  moonshot:     { base: "https://api.moonshot.ai",           format: "openai",    model: "kimi-k2.6" },
};

async function getPrDiff(octokit, owner, repo, prNumber) {
  const resp = await octokit.request(
    `GET /repos/${owner}/${repo}/pulls/${prNumber}`,
    { headers: { accept: "application/vnd.github.v3.diff" } }
  );
  return resp.data;
}

function filterDiff(diff, excludePatterns) {
  if (!excludePatterns || !diff) return diff;
  const patterns = excludePatterns.split(",").map(p => p.trim()).filter(Boolean);
  const blocks = diff.split(/^diff --git /gm);
  if (blocks.length <= 1) return diff;
  const header = blocks[0];
  const filtered = blocks.slice(1).filter(block => {
    const m = block.match(/^a\/(\S+)\s+b\/(\S+)/m);
    if (!m) return true;
    return !patterns.some(p => matchGlob(m[2], p));
  });
  return header + "diff --git " + filtered.join("diff --git ");
}

function matchGlob(str, pattern) {
  const r = pattern.replace(/\./g, "\\.").replace(/\*\*/g, "\x00").replace(/\*/g, "[^/]*").replace(/\x00/g, ".*");
  return new RegExp("^" + r + "$").test(str);
}

async function callOpenAI(apiBase, apiKey, model, systemPrompt, userContent, maxTokens) {
  const url = `${apiBase}/v1/chat/completions`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function callAnthropic(apiBase, apiKey, model, systemPrompt, userContent, maxTokens) {
  const url = `${apiBase}/v1/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
      max_tokens: maxTokens,
    }),
  });
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.content[0].text;
}

async function postReview(octokit, owner, repo, prNumber, reviewerName, content) {
  await octokit.rest.issues.createComment({
    owner, repo,
    issue_number: prNumber,
    body: `## 🤖 ${reviewerName}\n\n${content}`,
  });
}

async function run() {
  try {
    const apiKey = core.getInput("api_key", { required: true });
    const provider = core.getInput("provider") || "";
    const apiBaseInput = core.getInput("api_base") || "";
    const apiFormatInput = core.getInput("api_format") || "";
    const modelInput = core.getInput("model") || "";
    const systemPrompt = core.getInput("system_prompt");
    const reviewerName = core.getInput("reviewer_name") || "AI Code Review";
    const excludePatterns = core.getInput("exclude_patterns");
    const maxDiffChars = parseInt(core.getInput("max_diff_chars") || "0");
    const maxTokens = parseInt(core.getInput("max_tokens") || "4096");
    const githubToken = core.getInput("github_token");

    // 解析配置：preset 提供默认值，显式输入可覆盖
    let apiBase, apiFormat, model;

    if (provider && PRESETS[provider]) {
      const p = PRESETS[provider];
      apiBase = apiBaseInput || p.base;
      apiFormat = apiFormatInput || p.format;
      model = modelInput || p.model;
    } else if (provider) {
      throw new Error(`Unknown provider: ${provider}. Available: ${Object.keys(PRESETS).join(", ")}`);
    } else {
      if (!apiBaseInput) throw new Error("Either provider or api_base is required");
      apiBase = apiBaseInput;
      apiFormat = apiFormatInput || "openai";
      model = modelInput;
    }

    if (!model) throw new Error("model is required");

    if (!["openai", "anthropic"].includes(apiFormat)) {
      throw new Error(`api_format must be "openai" or "anthropic", got: ${apiFormat}`);
    }

    core.info(`API: ${apiBase} (${apiFormat})  Model: ${model}`);

    // PR 信息
    const octokit = github.getOctokit(githubToken);
    const ctx = github.context;

    if (!ctx.payload.pull_request) {
      core.warning("This action needs pull_request_target event. Skipping.");
      return;
    }

    const { owner, repo } = ctx.repo;
    const prNumber = ctx.payload.pull_request.number;
    core.info(`PR #${prNumber} in ${owner}/${repo}`);

    // 获取 diff
    let diff = await getPrDiff(octokit, owner, repo, prNumber);
    if (!diff || !diff.trim()) {
      core.info("No diff found. Skipping.");
      return;
    }

    if (excludePatterns) diff = filterDiff(diff, excludePatterns);
    if (maxDiffChars > 0 && diff.length > maxDiffChars) {
      core.info(`Diff truncated from ${diff.length} to ${maxDiffChars} chars`);
      diff = diff.substring(0, maxDiffChars);
    }
    core.info(`Diff size: ${diff.length} chars`);

    const userContent = `Please review the following pull request code changes:\n\n\`\`\`diff\n${diff}\n\`\`\``;

    // 调用 AI
    const review = apiFormat === "anthropic"
      ? await callAnthropic(apiBase, apiKey, model, systemPrompt, userContent, maxTokens)
      : await callOpenAI(apiBase, apiKey, model, systemPrompt, userContent, maxTokens);

    core.info("AI review completed");
    await postReview(octokit, owner, repo, prNumber, reviewerName, review);
    core.info("Review posted successfully!");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();