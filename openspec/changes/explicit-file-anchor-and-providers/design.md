# 设计：显式文件锚定（原子）与多供应商 Provider 支持

## Context

- 锚点字段 `anchorFilePath` 已存在于 `ConversationFile`（诉求1 引入），沉淀目录派生逻辑（`buildTreeExportPlan`）已工作。
- 会话写入已有原子保障：tree command 是纯函数（clone → 变更 → `parseConversation` 校验），持久化走 checksum + tmp 文件 + revision 冲突检测。
- wire 适配器已存在四套；缺的是"供应商 → 协议 + 端点"映射层与设置层解除 deepseek 硬编码。

## Goals / Non-goals

见 proposal。补充设计层面的非目标：不引入异步锁库，原子性依赖现有 revision 机制。

## Decisions

### D1: pending anchor 放在 conversation 外、UI 层

锚点未落库前保存在插件层的 `pendingAnchorByTab: Map<tabId, string>`，不进 `ConversationFile`。理由：conversation 是 canonical 数据，加临时字段会污染 schema、参与 checksum、增加回滚复杂度。落库发生在首条消息的 tree command 内——`continueNode`/`submitChildDraft` 的输入增加可选 `anchorFilePath`，与消息 append 在同一个纯函数调用里完成，天然原子。

### D2: 锚点写入条件收紧为「对话无任何用户消息」

现有条件是 `anchorFilePath 为空`（导致后续消息可补写）。改为：
```ts
const hasUserMessage = Object.values(state.nodes).some(n => n.messages.some(m => m.role === "user"));
if (!hasUserMessage && isMarkdownFile(input.anchorFilePath)) state.anchorFilePath = input.anchorFilePath;
```
`isMarkdownFile`：以 `.md`（大小写不敏感）结尾。锚点一旦写入即冻结（含"显式锚定"与"隐式当前文件"两种来源），对话中途换文件不再影响。修复后的回滚语义：`revertTreeCommand` 撤销首条消息时不撤锚点（锚点代表"对话的归属"，撤销一条消息不改变归属；这也避免 revision 校验复杂化）。

### D3: 右键菜单通过 obsidian Plugin API 注册

- `this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, ctx) => ...))`：主编辑区正文右键，`ctx.file` 为当前 md 文件。
- `this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => ...))`：文件管理器/标签页右键。
- 菜单项：「锚定 TreeTalk 对话到此笔记」（当前对话无用户消息且 file 是 .md 时可用）。点击 → 写 `pendingAnchorByTab` → Notice 确认 → 输入区上方显示锚点 chip（可移除）。
- 新对话场景（右键时无活动对话或活动对话已有消息）：自动 `createConversationTab()` 后锚定。

### D4: 供应商目录 = 纯数据 + 解析函数（对照 FrameLearn catalog.ts）

```ts
export type WireFormat = "openai_chat" | "anthropic" | "gemini";
export interface ProviderPreset {
  key: string; name: string; wire: WireFormat;
  baseUrl: string; aliases: readonly string[];
  models: readonly string[]; defaultModel: string;
  supportsThinking: boolean; supportsWebSearch: boolean; // 均 false 除 deepseek(web) / anthropic(thinking)
}
export const PROVIDER_PRESETS: Record<string, ProviderPreset> = { deepseek, zhipu, minimax, openrouter, kimi, siliconflow, dashscope, openai, anthropic, "openai-compatible" }
```
映射到既有 ProviderKind：`openai_chat` → `openai`（官方）或 `openai-compatible`；`anthropic` → `anthropic`；`gemini` → `gemini`。`currentProviderProfile()` 改为 `resolveProfile(settings)`：preset → kind + baseUrl + key。模型自由文本但按 preset.models 提供建议下拉（datalist 风格），不再强制 `deepseek-*` 前缀。

### D5: baseUrl 安全校验

设置保存时解析 URL：scheme 必须 https（`http://localhost`/`http://127.0.0.1` 放行但 Notice 警告明文）；拒绝 `user:pass@`；无 scheme 或解析失败报错不保存。

### D6: 能力降级 UI

`webSearchEnabled` 与 `answerThinkingMode` 的设置项和输入框按钮在当前 provider 不支持时 `disabled` + 描述说明「当前供应商不支持，仅 DeepSeek 支持联网」。引擎层已有 two-pass 回退（anthropic/gemini），无需改执行路由。

## Risks / Trade-offs

- **右键菜单在非 md 文件（PDF）上**：`file-menu` 的 `file instanceof TFile && extension === "md"` 过滤，PDF/Canvas 不显示菜单项。
- **anchor chip 的 UI 复杂度**：第一版 chip 只在输入区上方一行文本 + ×，不做文件选择器弹窗（用户已确认触发方式是右键，不需要第二个入口）。
- **模型名错误**：自由文本，错误模型名由供应商 API 报错，错误信息已会显示在消息状态里；preset 建议列表降低出错率。
- **数据迁移**：已存在的 `anchorFilePath` 数据不变；只是写入路径收紧，老对话读取完全兼容。

## Migration Path

1. 锚定部分独立合入（不改 provider，风险为零）。
2. provider 目录 + 设置 UI 第二步合入；`data.json` 里旧的 `provider:"deepseek"` 值在 `parseSettings` 中映射到新枚举。

## Open Questions

无——触发方式（正文右键为主）与首批供应商清单已与用户确认。
