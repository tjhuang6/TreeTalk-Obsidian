import { describe, expect, it } from "vitest";
import { AnchorRenameWorkflow } from "../../src/domain/anchor-rename-workflow";
import {
  AnchorRenamer,
  type StoredAnchorRecord
} from "../../src/domain/anchor-renamer";
import { createConversation } from "../../src/domain/conversation-factory";
import type { ConversationFile } from "../../src/domain/types";
import { NOW } from "../fixtures";

const VAULT_ID = "11111111-2222-3333-4444-555555555555";
const CTIME = 1700000000000;

function stored(id: string, path: string): StoredAnchorRecord {
  return {
    conversationId: id,
    folder: `.obsidian/treetalk-data/active/${id}`,
    anchorFilePath: path,
    anchorVaultId: VAULT_ID,
    anchorFileCtime: CTIME,
    revision: 1
  };
}

function open(path: string): ConversationFile {
  return {
    ...createConversation(),
    anchorFilePath: path,
    anchorVaultId: VAULT_ID,
    anchorFileCtime: CTIME
  };
}

describe("AnchorRenameWorkflow", () => {
  it("treats a file rename as exact without remapping unrelated siblings", async () => {
    const records = [stored("a", "Notes/a.md"), stored("other", "Notes/other.md")];
    const renamer = new AnchorRenamer({
      loadStored: async () => records,
      saveStored: async () => undefined,
      skipOpenConversationIds: new Set()
    });
    const openConversations = [open("Notes/a.md"), open("Notes/other.md")];
    const workflow = new AnchorRenameWorkflow(renamer);

    const result = await workflow.apply(
      { kind: "file", oldPath: "Notes/a.md", newPath: "Archive/a.md" },
      openConversations,
      NOW
    );

    expect(records.map((record) => record.anchorFilePath)).toEqual([
      "Archive/a.md",
      "Notes/other.md"
    ]);
    expect(result.openConversations.map((conversation) => conversation.anchorFilePath)).toEqual([
      "Archive/a.md",
      "Notes/other.md"
    ]);
  });

  it("remaps every pending, stored, and open anchor below a folder rename", async () => {
    const records = [stored("a", "Notes/a.md")];
    const renamer = new AnchorRenamer({
      loadStored: async () => records,
      saveStored: async () => undefined,
      skipOpenConversationIds: new Set()
    });
    renamer.setPending("tab", "Notes/pending.md");
    const openConversations = [open("Notes/open.md")];
    const workflow = new AnchorRenameWorkflow(renamer);

    const result = await workflow.apply(
      { kind: "folder", oldPath: "Notes", newPath: "Archive/Notes" },
      openConversations,
      NOW
    );

    expect(renamer.getPending("tab")).toBe("Archive/Notes/pending.md");
    expect(records[0]?.anchorFilePath).toBe("Archive/Notes/a.md");
    expect(result.openConversations[0]?.anchorFilePath).toBe("Archive/Notes/open.md");
  });

  it("does not mutate frozen store conversations while preparing persisted open updates", async () => {
    const renamer = new AnchorRenamer({
      loadStored: async () => [],
      saveStored: async () => undefined,
      skipOpenConversationIds: new Set()
    });
    const conversation = Object.freeze(open("Notes/a.md"));
    const workflow = new AnchorRenameWorkflow(renamer);

    const result = await workflow.apply(
      { kind: "file", oldPath: "Notes/a.md", newPath: "Notes/b.md" },
      [conversation],
      NOW
    );

    expect(conversation.anchorFilePath).toBe("Notes/a.md");
    expect(result.openConversations[0]?.anchorFilePath).toBe("Notes/b.md");
  });
});
