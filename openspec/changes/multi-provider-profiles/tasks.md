# 任务：多供应商配置档

## 1. 数据模型与迁移（领域层，TDD）

- [ ] 1.1 新增 `src/providers/provider-profiles.ts`：`ProviderProfileConfig` / `ProviderProfilesState` 类型，
      `createDefaultProfileFromLegacy(settings)`、`profileSecretId(profileId)`、
      `resolveActiveProfile(state, legacyFallback)`（找不到 active 回退首个再回退 legacy）。纯函数，不 import obsidian。
- [ ] 1.2 `plugin-data.ts`：`TreeTalkSettings` 增加 `providerProfiles?: ProviderProfilesState`；
      解析时缺失=空 state；保留旧 provider/model/baseUrl 字段。补解析/默认值测试。
- [ ] 1.3 补测试：空 state、含多个 profile、active 指向不存在 id 时的回退。

## 2. 运行期迁移与活动 profile（main.ts，TDD 用可注入的 secret port）

- [ ] 2.1 抽一个可测的 secret 访问接口（getSecret/setSecret/listSecrets 的最小封装或直接注入），
      避免 main.ts 直接耦合 app.secretStorage 而无法测。
- [ ] 2.2 onload 迁移：providerProfiles 为空时，用旧字段建「默认」profile，
      复制 `treetalk-api-key` → `treetalk-key-<id>`，写回 settings。幂等（非空不迁移）。补测试。
- [ ] 2.3 `activeProfileConfig()` / `getApiKey()` / `currentProviderProfile()` 改为读活动 profile 与其 secret。
- [ ] 2.4 发送路径：`webSearchEnabled`（provider==="deepseek"）、`modelId` 改取活动 profile。补测试。

## 3. 设置 UI（settings-tab.ts）

- [ ] 3.1 「模型 API」组重构：活动配置档下拉（切换 activeProfileId）、新增配置档、删除当前配置档（至少留一个）。
- [ ] 3.2 当前 profile 的 供应商/模型/baseUrl/APIKey 编辑写入活动 profile 与对应 secret；baseUrl 用 validateBaseUrl 校验。
- [ ] 3.3 切换/新增/删除后刷新 UI 并持久化。

## 4. 回归与验证

- [ ] 4.1 确认 provider wire 路由未改动（DeepSeek chat/completions、MiniMax anthropic 端点、thinking）。
- [ ] 4.2 `openspec validate multi-provider-profiles --strict` 通过。
- [ ] 4.3 `npm run check` 全绿（vitest+tsc+eslint+build+regression），重新生成 main.js。
- [ ] 4.4 README/CHANGELOG 记录多配置档功能与迁移说明。
