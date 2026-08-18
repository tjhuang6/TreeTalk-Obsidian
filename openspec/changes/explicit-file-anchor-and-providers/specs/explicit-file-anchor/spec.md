# explicit-file-anchor 变更

## ADDED Requirements

### Requirement: 锚点仅可显式或首条消息隐式确定一次
系统 SHALL 仅在对话尚不存在任何用户消息时写入 `anchorFilePath`。锚点来源优先级为：显式右键锚定（pending anchor）> 发送时的活动 `.md` 文件。一旦写入，后续任何操作 MUST NOT 修改或清除锚点。

#### Scenario: 右键锚定后发送首条消息
- **WHEN** 用户在笔记正文右键选择「锚定 TreeTalk 对话到此笔记」，随后发送首条消息
- **THEN** 该消息所在 tree command 在同一 revision 内写入 `anchorFilePath`，对话树沉淀目录为 `<笔记名>-tree/`

#### Scenario: 后续消息不能补写锚点
- **WHEN** 对话首条消息发出时没有任何锚点来源（无 pending、无活动 md 文件）
- **THEN** 之后任何消息发送都不得写入 `anchorFilePath`，沉淀回退到设置的 `treeCaptureFolder`

#### Scenario: 非 Markdown 文件不能成为锚点
- **WHEN** 锚点来源路径不以 `.md` 结尾（大小写不敏感）
- **THEN** 系统拒绝写入锚点，右键菜单项不显示

### Requirement: 锚定是原子操作
pending anchor MUST NOT 进入 canonical 会话数据；`anchorFilePath` MUST 与首条用户消息在同一次 `continueNode`/`submitChildDraft` 调用中落库，经 `parseConversation` 校验并只递增一次 revision。

#### Scenario: 首条消息落锚与消息原子提交
- **WHEN** 带有 pending anchor 的首条消息被提交
- **THEN** 结果会话同时包含新消息与锚点，revision 恰好 +1，任何中间状态不可被其他观察者看到

# provider-catalog 变更

## ADDED Requirements

### Requirement: 内置供应商目录
系统 SHALL 内置以下供应商 preset：deepseek、zhipu、minimax、openrouter、kimi(moonshot)、siliconflow、dashscope、openai、anthropic、openai-compatible（自定义端点）。每个 preset MUST 声明 wire 格式（`openai_chat`/`anthropic`/`gemini`）、默认 base_url、别名列表、建议模型列表与能力位（thinking/webSearch）。

#### Scenario: preset 映射到既有 wire 适配器
- **WHEN** 设置的 provider 为任一内置 preset
- **THEN** `resolveProfile` 返回的 `kind` 属于既有 `ProviderKind`，请求端点为 preset 的 base_url（用户覆盖 baseUrl 时除外）

#### Scenario: 别名解析
- **WHEN** provider 值为别名（如 `glm`、`moonshot`、`qwen`）
- **THEN** 解析到对应 canonical key

### Requirement: 设置层解除 deepseek 硬编码
`provider` 设置 SHALL 接受任意 preset key/别名；模型名 SHALL NOT 因非 `deepseek-` 前缀被重置。旧 `data.json` 中 `provider:"deepseek"` MUST 无损迁移。

#### Scenario: 切换到智谱 GLM
- **WHEN** 用户在设置中选择 zhipu 并填入模型与 API Key
- **THEN** 后续请求发往智谱端点，协议为 openai_chat，模型名原样传递

### Requirement: 能力位驱动 UI 降级
webSearch 控件仅在 provider 支持联网（当前仅 deepseek）时可用；thinking 控件仅对支持的 provider 可用。不支持的控件 MUST 禁用并显示原因。

#### Scenario: 非 DeepSeek 供应商下联网开关禁用
- **WHEN** 当前 provider 为 anthropic
- **THEN** 联网模式开关禁用，描述注明仅 DeepSeek 支持

### Requirement: baseUrl 安全校验
用户自定义 API 地址 MUST 通过校验：scheme 为 https；`http://localhost`/`http://127.0.0.1` 允许但提示明文风险；含内嵌用户名密码的 URL 拒绝保存。

#### Scenario: 拒绝明文公网地址
- **WHEN** 用户填入 `http://api.example.com`
- **THEN** 设置不保存并提示必须使用 https
