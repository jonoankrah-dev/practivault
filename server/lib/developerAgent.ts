import { SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

// Allowed root for safety (only within the project)
const PROJECT_ROOT = process.cwd();

type DeveloperAgentUser = {
  id: string;
  email: string | null;
};

function parseAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isDeveloperAgentAuthorized(
  user: DeveloperAgentUser,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  // Default-deny: this route can read and write project files, so access must
  // be granted explicitly by deployment configuration.
  const allowedUserIds = parseAllowlist(env.DEVELOPER_AGENT_ALLOWED_USER_IDS);
  const allowedEmails = parseAllowlist(env.DEVELOPER_AGENT_ALLOWED_EMAILS);
  const email = user.email?.toLowerCase() || "";

  return allowedUserIds.has(user.id.toLowerCase()) || (!!email && allowedEmails.has(email));
}

function resolveSafePath(relativePath: string): string {
  const fullPath = path.resolve(PROJECT_ROOT, relativePath);
  const relativeToRoot = path.relative(PROJECT_ROOT, fullPath);

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error("Access outside project root is not allowed");
  }
  return fullPath;
}

export interface DeveloperTool {
  name: string;
  description: string;
  parameters: any;
}

export const DEVELOPER_TOOLS: DeveloperTool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file in the project. Use this to inspect code, configs, or any text file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root, e.g. 'server/routes.ts' or 'client/src/pages/Dashboard.tsx'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root (default: '.')",
        },
      },
    },
  },
  {
    name: "propose_edit",
    description: "Propose a code change to a file. This will show the user a clear diff for approval. The change is NOT applied until the user explicitly approves it.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path of the file to edit",
        },
        explanation: {
          type: "string",
          description: "Clear explanation of why this change is needed and what it does",
        },
        old_content: {
          type: "string",
          description: "The exact current content that will be replaced (must match precisely)",
        },
        new_content: {
          type: "string",
          description: "The new content that will replace the old_content",
        },
      },
      required: ["path", "explanation", "old_content", "new_content"],
    },
  },
  {
    name: "apply_edit",
    description: "Apply a previously proposed edit to a file. Only call this after the user has explicitly approved the proposal.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path of the file to edit",
        },
        new_content: {
          type: "string",
          description: "The new content to write to the file",
        },
      },
      required: ["path", "new_content"],
    },
  },
];

export async function executeDeveloperTool(name: string, args: any) {
  if (name === "read_file") {
    const safePath = resolveSafePath(args.path);
    const content = await fs.readFile(safePath, "utf-8");
    return { path: args.path, content };
  }

  if (name === "list_directory") {
    const safePath = resolveSafePath(args.path || ".");
    const entries = await fs.readdir(safePath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "directory" : "file",
    }));
  }

  if (name === "propose_edit") {
    const { path, explanation, old_content, new_content } = args;
    const safePath = resolveSafePath(path);

    // For Phase 1 we don't write — we just return a clean diff for the user to review
    const diff = createSimpleDiff(old_content, new_content);

    return {
      path,
      explanation,
      diff,
      status: "proposed",
      message: "Edit proposed. The user must approve before it is applied.",
    };
  }

  if (name === "apply_edit") {
    const { path, new_content } = args;
    const safePath = resolveSafePath(path);
    await fs.writeFile(safePath, new_content, "utf-8");
    return {
      path,
      status: "applied",
      message: `Successfully applied edit to ${path}.`,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function createSimpleDiff(oldStr: string, newStr: string): string {
  // Very simple line-based diff for Phase 1
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  let diff = `--- ${oldStr.length} bytes\n+++ ${newStr.length} bytes\n`;
  diff += "@@ proposed change @@\n";

  // For simplicity, show first few changed lines
  const maxShow = 8;
  for (let i = 0; i < Math.min(maxShow, Math.max(oldLines.length, newLines.length)); i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i]) diff += `- ${oldLines[i]}\n`;
      if (newLines[i]) diff += `+ ${newLines[i]}\n`;
    }
  }
  if (oldLines.length > maxShow || newLines.length > maxShow) {
    diff += "... (truncated)\n";
  }
  return diff;
}