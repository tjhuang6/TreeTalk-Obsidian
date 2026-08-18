import { describe, expect, it } from "vitest";
import {
  createDefaultProfileFromLegacy,
  migrateLegacyProviderProfile,
  profileSecretId,
  resolveActiveProfile,
  type ProviderProfilesState
} from "../../src/providers/provider-profiles";

describe("provider profiles", () => {
  it("creates a default profile from legacy settings", () => {
    const profile = createDefaultProfileFromLegacy({ provider: "deepseek", model: "deepseek-chat", baseUrl: "" });
    expect(profile.label).toBe("默认");
    expect(profile.provider).toBe("deepseek");
    expect(profileSecretId(profile.id)).toBe(`treetalk-key-${profile.id}`);
  });

  it("resolves active profile, then first profile, then legacy fallback", () => {
    const first = { id: "first", label: "First", provider: "deepseek", model: "a", baseUrl: "" };
    const second = { id: "second", label: "Second", provider: "minimax", model: "b", baseUrl: "" };
    const state: ProviderProfilesState = { activeProfileId: "missing", profiles: [first, second] };
    expect(resolveActiveProfile(state, second)).toBe(first);
    expect(resolveActiveProfile({ activeProfileId: "second", profiles: [first, second] }, first)).toBe(second);
    expect(resolveActiveProfile({ activeProfileId: null, profiles: [] }, first)).toBe(first);
  });

  it("migrates the legacy secret once and never overwrites existing profiles", async () => {
    const secrets = new Map([["treetalk-api-key", "legacy-key"]]);
    const port = { getSecret: (id: string) => secrets.get(id) ?? null, setSecret: (id: string, value: string) => { secrets.set(id, value); }, listSecrets: () => [...secrets.keys()] };
    const migrated = await migrateLegacyProviderProfile({ provider: "deepseek", model: "m", baseUrl: "" }, port);
    expect(migrated.profiles).toHaveLength(1);
    expect(secrets.get(profileSecretId(migrated.profiles[0]!.id))).toBe("legacy-key");
    const existing = { activeProfileId: "existing", profiles: [{ id: "existing", label: "Existing", provider: "minimax", model: "x", baseUrl: "" }] };
    expect(await migrateLegacyProviderProfile({ provider: "deepseek", model: "m", baseUrl: "", providerProfiles: existing }, port)).toBe(existing);
  });
});
