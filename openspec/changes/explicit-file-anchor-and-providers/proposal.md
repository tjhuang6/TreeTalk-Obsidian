# 提案：显式文件锚定（原子）与多供应商 Provider 支持

## 问题

1. **锚定不可控**：当前 `anchorFilePath` 只能在发首条消息时由 `getActiveFile()` 隐式决定，用户无法显式选择锚定哪个文件；且实现有缺陷——任意后续消息都可能补写锚点、不筛 `.md`、PDF/Canvas 也会被当成锚点。
2. **供应商焊死**：wire 适配器层已有 openai / anthropic / gemini / deepseek 四套，但配置层把 provider 硬编码为 `"deepseek"`（`plugin-data.ts` 强制 `const provider: ProviderKind = "deepseek"`、`normalizeConfiguredModel` 把非 `deepseek-*` 模型重置、`main.ts` `currentProviderProfile()` 硬编码），用户无法选择其他供应商。

## 目标

1. 用户可以在**编辑器正文右键**和**文件管理器右键**中发起/锚定 TreeTalk 对话：右键笔记 →「锚定 TreeTalk 对话到此笔记」→ 发首条消息时，锚点在同一次 tree command 中原子落库（一次校验、一次 revision、一次持久化）。
2. 锚点语义收紧：仅 `.md` 可为锚；仅在对话尚无用户消息时写入；一次决定后不再变更；无锚对话永久回退 `treeCaptureFolder`。
3. 新增 FrameLearn 风格供应商目录（presets → wire 协议 + base_url + 别名），首批：zhipu(GLM)、minimax、openrouter、kimi/moonshot、siliconflow、dashscope(Qwen)、openai、anthropic 原生。设置页可选供应商与模型；Pi 引擎的联网搜索仅 DeepSeek 可用（UI 禁用并提示），thinking 仅 DeepSeek/Anthropic 可用。
4. baseUrl 校验：默认仅 https，拒绝内嵌凭据，localhost 需显式确认。

## Non-goals

- 不做 Provider 计量/多 profile 并存（单一活动 provider）。
- 不为非 DeepSeek 供应商实现联网搜索工具。
- 不重写 Pi 引擎；非 DeepSeek 的 anthropic/gemini 协议走既有 two-pass 兼容路径。
- 不做移动端。

## Impact

- 新增：`src/providers/presets.ts`（供应商目录）、锚定右键入口、`tests/providers/presets.test.ts`、锚定与 provider 设置测试
- 修改：`src/domain/tree-commands.ts`（锚点写入条件收紧 + pending anchor 输入）、`src/domain/types.ts`、`src/main.ts`（右键菜单注册、currentProviderProfile 改为从设置解析）、`src/tabs/plugin-data.ts`（provider/model 设置解除硬编码）、`src/settings-tab.ts`（供应商/模型选择 UI）、`manifest.json` 无需变更
