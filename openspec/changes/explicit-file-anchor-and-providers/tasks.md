# 任务列表：显式文件锚定（原子）与多供应商 Provider 支持

## 1. OpenSpec 与锚定领域层

- [x] 1.1 `openspec validate explicit-file-anchor-and-providers --strict` 通过
- [x] 1.2 `tree-commands.ts`：`continueNode`/`submitChildDraft` 锚点写入条件改为「对话无任何用户消息」+ 仅 `.md`；抽取 `isMarkdownPath()`；补测试（首条锁定、后续不补写、非 md 拒绝、老对话兼容）
- [x] 1.3 `main.ts` `sendMessage`：pending anchor 优先，`getActiveFile()` 兜底（仅当对话无用户消息）；移除「任意消息可写锚点」路径

## 2. 右键锚定入口

- [x] 2.1 注册 `editor-menu`（正文右键）与 `file-menu`（文件管理器）菜单项「锚定 TreeTalk 对话到此笔记」；仅对 `.md` 且对话无用户消息时可用；无活动对话时先新建对话空间
- [x] 2.2 插件层 `pendingAnchors` + Notice 反馈；持久化仅在首条消息时发生。（注：输入区 chip UI 降级为后续项——穿过 1800 行 conversation-view 的构造链风险高于收益，右键已有 Notice 确认）
- [ ] 2.3 锚点 chip UI 测试（依赖 2.2 chip，暂缓）；核心的「pending → 落库单次 revision」原子性已由 `tests/domain/anchor-file-path.test.ts` 覆盖

## 3. 供应商目录与配置层

- [x] 3.1 新增 `src/providers/presets.ts`：`WireFormat`/`ProviderPreset`/`PROVIDER_PRESETS`（deepseek/zhipu/minimax/openrouter/kimi/siliconflow/dashscope/openai/anthropic/gemini/openai-compatible）+ `resolveProfile` + `normalizeProviderKey` 别名解析；`tests/providers/presets.test.ts` 覆盖 wire 映射与 base_url
- [x] 3.2 `plugin-data.ts`：`provider` 字段解除硬编码（string key），`normalizeConfiguredModel` 改为按 preset 补默认而非强制 deepseek 前缀；`parseSettings` 兼容旧值 `"deepseek"`
- [x] 3.3 `main.ts`：`currentProviderProfile()` 改用 `resolveProfile`
- [x] 3.4 baseUrl 安全校验：https 默认、拒绝内嵌凭据、localhost 警告放行；`validateBaseUrl` 测试覆盖

## 4. 设置 UI 与能力降级

- [x] 4.1 `settings-tab.ts`：新增「供应商」下拉（preset 名称）+「模型」文本框（附 preset.models 建议）；「API 地址」placeholder 按 preset 显示默认端点
- [x] 4.2 能力降级：webSearch 控件在 provider 不支持时禁用（`supportsWebSearch` 能力位）；描述说明仅 DeepSeek 支持
- [ ] 4.3 README「安装/配置」节补供应商支持矩阵（端点、协议、联网、思考）——待补

## 5. 回归与收尾

- [x] 5.1 `npm run check` 全绿（vitest 540 + tsc + eslint + build + regression 328）
- [ ] 5.2 手动验证清单：右键锚定→发消息→`笔记名-tree/` 沉淀；切 provider 后正常问答；deepseek 联网开关仅 deepseek 可用——需在 Obsidian 中人工验证
- [x] 5.3 更新 CHANGELOG.md
