import { NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";
import fs from "fs/promises";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { ComposerChat, ComposerData } from "@/types/workspace";
import os from "os";

function getDefaultWorkspacePath() {
  const homeDir = os.homedir();
  const platform = process.platform;

  if (platform === "win32") {
    // Windows
    return path.join(
      process.env.APPDATA || "",
      "Cursor",
      "User",
      "workspaceStorage"
    );
  } else if (platform === "darwin") {
    // macOS
    return path.join(
      homeDir,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "workspaceStorage"
    );
  } else {
    // Linux and others
    return path.join(homeDir, ".config", "Cursor", "User", "workspaceStorage");
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const workspacePath =
      process.env.WORKSPACE_PATH || getDefaultWorkspacePath();
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dbPath = path.join(workspacePath, entry.name, "state.vscdb");

        if (!existsSync(dbPath)) continue;

        const db = await open({
          filename: dbPath,
          driver: sqlite3.Database,
        });

        const result = await db.get(`
          SELECT value FROM ItemTable 
          WHERE [key] = 'composer.composerData'
        `);

        await db.close();

        if (result?.value) {
          const composerData = JSON.parse(result.value) as ComposerData;
          const composer = composerData.allComposers.find(
            (c: ComposerChat) => c.composerId === params.id
          );
          if (composer) {
            return NextResponse.json(composer);
          }
        }
      }
    }

    return NextResponse.json({ error: "Composer not found" }, { status: 404 });
  } catch (error) {
    console.error("Failed to get composer:", error);
    return NextResponse.json(
      { error: "Failed to get composer" },
      { status: 500 }
    );
  }
}
