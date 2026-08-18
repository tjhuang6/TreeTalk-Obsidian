import {
  relocateVerifiedAnchor,
  type AnchorRelocationResult,
  type AnchorRelocatorPort
} from "./anchor-relocator";
import { parseConversation } from "./schema";
import type { StoredAnchorRecord } from "./anchor-renamer";
import type { ConversationFile } from "./types";

export interface StoredAnchorPersistencePort {
  load: (folder: string) => Promise<ConversationFile>;
  save: (
    folder: string,
    conversation: ConversationFile,
    expectedRevision: number
  ) => Promise<unknown>;
}

function isVerifiedInCurrentVault(
  conversation: ConversationFile,
  currentVaultId: string
): boolean {
  return (
    conversation.anchorVaultId === currentVaultId &&
    typeof conversation.anchorFilePath === "string" &&
    typeof conversation.anchorFileCtime === "number"
  );
}

/** Creates a validated save candidate without mutating repository-loaded data. */
export function prepareStoredAnchorSave(
  loaded: ConversationFile,
  record: StoredAnchorRecord,
  now: string
): ConversationFile {
  const updated = structuredClone(loaded) as ConversationFile;
  updated.anchorFilePath = record.anchorFilePath;
  updated.anchorVaultId = record.anchorVaultId;
  updated.anchorFileCtime = record.anchorFileCtime;
  updated.revision = loaded.revision + 1;
  updated.updatedAt = now;
  return parseConversation(updated);
}

/** Saves a rename update with the revision observed by the preceding load. */
export async function saveStoredAnchorRecord(
  persistence: StoredAnchorPersistencePort,
  record: StoredAnchorRecord,
  now: string
): Promise<void> {
  const loaded = await persistence.load(record.folder);
  const updated = prepareStoredAnchorSave(loaded, record, now);
  await persistence.save(record.folder, updated, loaded.revision);
}

/**
 * Relocates one closed record only when its verified anchor belongs to this Vault.
 * Missing and ambiguous results intentionally remain unpersisted.
 */
export async function relocateStoredAnchorRecord(
  persistence: StoredAnchorPersistencePort,
  folder: string,
  currentVaultId: string,
  relocator: AnchorRelocatorPort,
  now: string
): Promise<AnchorRelocationResult> {
  const loaded = await persistence.load(folder);
  if (!isVerifiedInCurrentVault(loaded, currentVaultId)) {
    return { kind: "skipped", conversation: loaded };
  }
  const result = await relocateVerifiedAnchor(loaded, relocator, now);
  if (result.kind === "relocated") {
    await persistence.save(folder, result.conversation, loaded.revision);
  }
  return result;
}

export interface TreeCaptureAnchorRelocationInput {
  conversation: ConversationFile;
  currentVaultId: string | undefined;
  relocator: AnchorRelocatorPort | undefined;
  now: string;
  updateConversation: (conversation: ConversationFile) => Promise<void> | void;
  flushPersistence: () => Promise<void>;
}

/**
 * Makes tree capture consume a persisted, verified relocation. Any unverified,
 * foreign, missing, or ambiguous anchor is returned unchanged for preflight.
 */
export async function relocateTreeCaptureAnchor(
  input: TreeCaptureAnchorRelocationInput
): Promise<ConversationFile> {
  const { conversation, currentVaultId, relocator } = input;
  if (
    currentVaultId === undefined ||
    relocator === undefined ||
    !isVerifiedInCurrentVault(conversation, currentVaultId)
  ) {
    return conversation;
  }
  const result = await relocateVerifiedAnchor(conversation, relocator, input.now);
  if (result.kind !== "relocated") return conversation;
  await input.updateConversation(result.conversation);
  await input.flushPersistence();
  return result.conversation;
}
