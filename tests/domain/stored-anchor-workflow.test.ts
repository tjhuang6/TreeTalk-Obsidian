import { describe, expect, it, vi } from "vitest";
import {
  relocateStoredAnchorRecord,
  relocateTreeCaptureAnchor,
  saveStoredAnchorRecord
} from "../../src/domain/stored-anchor-workflow";
import type { AnchorRelocatorPort } from "../../src/domain/anchor-relocator";
import { createConversation } from "../../src/domain/conversation-factory";
import type { StoredAnchorRecord } from "../../src/domain/anchor-renamer";
import type { ConversationFile } from "../../src/domain/types";

const VAULT_ID = "11111111-2222-3333-4444-555555555555";
const FOREIGN_VAULT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CTIME = 1700000000000;
const NOW = "2026-08-18T00:00:00.000Z";

function conversation(overrides: Partial<ConversationFile> = {}): ConversationFile {
  return {
    ...createConversation(),
    anchorVaultId: VAULT_ID,
    anchorFilePath: "Notes/old.md",
    anchorFileCtime: CTIME,
    revision: 3,
    ...overrides
  };
}

function legacyConversation(): ConversationFile {
  const value = conversation();
  delete value.anchorVaultId;
  return value;
}

function record(): StoredAnchorRecord {
  return {
    conversationId: "c1",
    folder: ".obsidian/treetalk-data/active/c1",
    anchorVaultId: VAULT_ID,
    anchorFilePath: "Notes/new.md",
    anchorFileCtime: CTIME,
    revision: 4
  };
}

function relocatedPort(): AnchorRelocatorPort {
  return {
    resolveCurrentPath: async () => undefined,
    getCtime: async () => undefined,
    findCandidatesByCtime: async () => ["Notes/new.md"]
  };
}

describe("saveStoredAnchorRecord", () => {
  it("clones a deeply frozen loaded conversation before updating and saves using its old revision", async () => {
    const loaded = structuredClone(conversation());
    Object.freeze(loaded.nodes);
    Object.freeze(loaded);
    const save = vi.fn(async () => undefined);

    await saveStoredAnchorRecord(
      { load: async () => loaded, save },
      record(),
      NOW
    );

    expect(loaded.anchorFilePath).toBe("Notes/old.md");
    expect(loaded.revision).toBe(3);
    expect(save).toHaveBeenCalledWith(
      record().folder,
      expect.objectContaining({
        anchorFilePath: "Notes/new.md",
        anchorVaultId: VAULT_ID,
        anchorFileCtime: CTIME,
        revision: 4,
        updatedAt: NOW
      }),
      3
    );
  });
});

describe("relocateStoredAnchorRecord", () => {
  it("persists a same-Vault unique ctime relocation using the loaded revision", async () => {
    const loaded = structuredClone(conversation());
    Object.freeze(loaded);
    const save = vi.fn(async () => undefined);

    const result = await relocateStoredAnchorRecord(
      { load: async () => loaded, save },
      record().folder,
      VAULT_ID,
      relocatedPort(),
      NOW
    );

    expect(result.kind).toBe("relocated");
    expect(loaded.anchorFilePath).toBe("Notes/old.md");
    expect(save).toHaveBeenCalledWith(
      record().folder,
      expect.objectContaining({
        anchorFilePath: "Notes/new.md",
        revision: 4,
        updatedAt: NOW
      }),
      3
    );
  });

  it("rejects a foreign Vault before ctime lookup and does not save", async () => {
    const findCandidatesByCtime = vi.fn(async () => ["Notes/new.md"]);
    const save = vi.fn(async () => undefined);

    const result = await relocateStoredAnchorRecord(
      { load: async () => conversation({ anchorVaultId: FOREIGN_VAULT_ID }), save },
      record().folder,
      VAULT_ID,
      {
        resolveCurrentPath: async () => undefined,
        getCtime: async () => undefined,
        findCandidatesByCtime
      },
      NOW
    );

    expect(result.kind).toBe("skipped");
    expect(findCandidatesByCtime).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", []],
    ["ambiguous", ["Notes/a.md", "Notes/b.md"]]
  ])("does not save a %s ctime result", async (_kind, candidates) => {
    const save = vi.fn(async () => undefined);
    const result = await relocateStoredAnchorRecord(
      { load: async () => conversation(), save },
      record().folder,
      VAULT_ID,
      {
        resolveCurrentPath: async () => undefined,
        getCtime: async () => undefined,
        findCandidatesByCtime: async () => candidates
      },
      NOW
    );

    expect(result.kind).toBe(_kind);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("relocateTreeCaptureAnchor", () => {
  it("updates the tab, flushes persistence, and returns the relocated conversation before tree capture", async () => {
    const updated: ConversationFile[] = [];
    const calls: string[] = [];
    const result = await relocateTreeCaptureAnchor({
      conversation: conversation(),
      currentVaultId: VAULT_ID,
      relocator: relocatedPort(),
      now: NOW,
      updateConversation: async (next: ConversationFile) => {
        calls.push("update");
        updated.push(next);
      },
      flushPersistence: async () => {
        calls.push("flush");
      }
    });

    expect(result.anchorFilePath).toBe("Notes/new.md");
    expect(updated[0]?.anchorFilePath).toBe("Notes/new.md");
    expect(calls).toEqual(["update", "flush"]);
  });

  it.each([
    ["foreign", conversation({ anchorVaultId: FOREIGN_VAULT_ID }), relocatedPort()],
    ["legacy", legacyConversation(), relocatedPort()],
    [
      "missing",
      conversation(),
      {
        resolveCurrentPath: async () => undefined,
        getCtime: async () => undefined,
        findCandidatesByCtime: async () => []
      }
    ],
    [
      "ambiguous",
      conversation(),
      {
        resolveCurrentPath: async () => undefined,
        getCtime: async () => undefined,
        findCandidatesByCtime: async () => ["Notes/a.md", "Notes/b.md"]
      }
    ]
  ] as const)("does not mutate or flush a %s anchor", async (_kind, input, relocator) => {
    const updateConversation = vi.fn(async () => undefined);
    const flushPersistence = vi.fn(async () => undefined);
    const result = await relocateTreeCaptureAnchor({
      conversation: input,
      currentVaultId: VAULT_ID,
      relocator,
      now: NOW,
      updateConversation,
      flushPersistence
    });

    expect(result).toBe(input);
    expect(updateConversation).not.toHaveBeenCalled();
    expect(flushPersistence).not.toHaveBeenCalled();
  });
});
