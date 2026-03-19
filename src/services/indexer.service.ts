import prisma from "../lib/prisma";
import { getFileContent, getRepoTree, getCommitCount } from "./github.service";
import { summarizeFile } from "./ai.service";

const IGNORED_PATTERNS = [/node_modules/, /\.git/, /dist/, /build/, /\.lock$/i];
const SUMMARY_PATTERNS = [
  /README\.md$/i,
  /package\.json$/i,
  /index\.(ts|js|tsx|jsx)$/i,
  /auth/i,
  /payment/i,
  /config/i,
];

const shouldSkipPath = (path: string) => IGNORED_PATTERNS.some((pattern) => pattern.test(path));
const needsSummary = (path: string) => SUMMARY_PATTERNS.some((pattern) => pattern.test(path));

export const indexRepository = async (repoId: string, token: string) => {
  const repo = await prisma.repo.findUnique({ where: { id: repoId } });

  if (!repo) {
    throw new Error("Repo not found");
  }

  let tree;
  try {
    tree = await getRepoTree(repo.fullName, token);
  } catch (error) {
    console.error("Failed to get repo tree:", error);
    throw new Error("Failed to fetch repository tree from GitHub");
  }

  const githubFiles = tree.filter(
    (node) => node.type === "blob" && !shouldSkipPath(node.path ?? "")
  );

  const dbFiles = await prisma.repoFile.findMany({
    where: { repoId },
  });

  const dbMap = new Map(dbFiles.map(f => [f.path, f]));
  const githubMap = new Map(githubFiles.map(f => [f.path, f]));

  let created = 0;
  let updated = 0;

  // 🔹 INSERT + UPDATE
  for (const file of githubFiles) {
    if (!file.path) continue;

    const existing = dbMap.get(file.path);

    const name = file.path.split("/").pop() ?? file.path;
    const extension = name.includes(".") ? name.split(".").pop() ?? null : null;

    if (!existing) {
      // 🟢 NEW FILE
      let content: string | null = null;
      let summary: string | null = null;

      if (needsSummary(file.path)) {
        try {
          content = await getFileContent(repo.fullName, file.path, token);
          if (content) {
            // Check if content contains binary data (null bytes)
            if (content.includes('\x00')) {
              console.warn(`Skipping binary content for ${file.path}`);
              content = null;
            } else {
              // summary = await summarizeFile(file.path, content);
            }
          }
        } catch (error) {
          console.error(`Failed to get content for ${file.path}:`, error);
        }
      }

      let commitCount = 0;
      try {
        commitCount = await getCommitCount(repo.fullName, file.path, token);
      } catch (error) {
        console.error(`Failed to get commit count for ${file.path}:`, error);
      }

      await prisma.repoFile.create({
        data: {
          repoId,
          path: file.path,
          name,
          extension,
          size: file.size ?? null,
          summary,
          content,
          commitCount,
        },
      });

      created++;
    } else {
      // 🟡 UPDATE if changed
      if (existing.size !== file.size) {
        await prisma.repoFile.update({
          where: { id: existing.id },
          data: {
            size: file.size ?? null,
          },
        });

        updated++;
      }
    }
  }

  // 🔴 DELETE removed files
  const githubPaths = new Set(githubFiles.map(f => f.path));

  const toDelete = dbFiles.filter(f => !githubPaths.has(f.path));

  if (toDelete.length > 0) {
    await prisma.repoFile.deleteMany({
      where: {
        id: { in: toDelete.map(f => f.id) },
      },
    });
  }

  await prisma.repo.update({
    where: { id: repoId },
    data: {
      isIndexed: true,
      indexedAt: new Date(),
    },
  });

  return {
    success: true,
    created,
    updated,
    deleted: toDelete.length,
    total: githubFiles.length,
  };
};