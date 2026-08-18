import type { AnchorRenamer, RenameResult } from "./anchor-renamer";
import type { ConversationFile } from "./types";

export type VaultRename =
  | { kind: "file"; oldPath: string; newPath: string }
  | { kind: "folder"; oldPath: string; newPath: string };

export interface AnchorRenameWorkflowResult {
  stored: RenameResult | null;
  openConversations: ConversationFile[];
}

/**
 * Applies one Vault rename event to every anchor population.
 *
 * File and folder events have intentionally separate routes. A file move between
 * directories MUST NOT be broadened into a parent-directory remap, because that
 * would rewrite anchors for unrelated sibling files.
 */
export class AnchorRenameWorkflow {
  constructor(private readonly renamer: AnchorRenamer) {}

  async apply(
    rename: VaultRename,
    openConversations: ConversationFile[],
    now: string
  ): Promise<AnchorRenameWorkflowResult> {
    const updatedOpenConversations = openConversations.map(
      (conversation) => structuredClone(conversation) as ConversationFile
    );
    if (rename.kind === "file") {
      const stored = await this.renamer.applyExactRename(
        rename.oldPath,
        rename.newPath,
        now
      );
      await this.renamer.applyExactRenameToOpen(
        updatedOpenConversations,
        rename.oldPath,
        rename.newPath
      );
      return { stored, openConversations: updatedOpenConversations };
    }

    const stored = await this.renamer.applyFolderMove(
      rename.oldPath,
      rename.newPath,
      now
    );
    await this.renamer.applyFolderMoveToOpen(
      updatedOpenConversations,
      rename.oldPath,
      rename.newPath
    );
    return { stored, openConversations: updatedOpenConversations };
  }
}
