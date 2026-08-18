export interface ProviderProfileConfig {
  id: string;
  label: string;
  provider: string;
  model: string;
  baseUrl: string;
}

export interface ProviderProfilesState {
  activeProfileId: string | null;
  profiles: ProviderProfileConfig[];
}

export interface LegacyProviderSettings {
  provider: string;
  model: string;
  baseUrl: string;
}

export function createDefaultProfileFromLegacy(
  settings: LegacyProviderSettings,
  id = crypto.randomUUID()
): ProviderProfileConfig {
  return { id, label: "默认", provider: settings.provider, model: settings.model, baseUrl: settings.baseUrl };
}

export function profileSecretId(profileId: string): string {
  return `treetalk-key-${profileId}`;
}

export function resolveActiveProfile(
  state: ProviderProfilesState | undefined,
  legacyFallback: ProviderProfileConfig
): ProviderProfileConfig {
  const profiles = state?.profiles ?? [];
  return profiles.find((profile) => profile.id === state?.activeProfileId) ?? profiles[0] ?? legacyFallback;
}

export interface SecretPort {
  getSecret(id: string): string | null;
  setSecret(id: string, value: string): void;
  listSecrets(): string[];
}

export async function migrateLegacyProviderProfile(
  settings: { provider: string; model: string; baseUrl: string; providerProfiles?: ProviderProfilesState },
  secrets: SecretPort
): Promise<ProviderProfilesState> {
  const existing = settings.providerProfiles;
  if (existing !== undefined && existing.profiles.length > 0) return existing;
  const profile = createDefaultProfileFromLegacy(settings);
  const legacyKey = secrets.getSecret("treetalk-api-key") ?? "";
  secrets.setSecret(profileSecretId(profile.id), legacyKey);
  return { activeProfileId: profile.id, profiles: [profile] };
}
