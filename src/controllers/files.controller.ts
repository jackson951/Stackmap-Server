import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { getFileContent } from "../services/github.service";

const buildFileName = (filePath: string) => filePath.split("/").pop() ?? filePath;

export const getRepoFileContent = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const repoIdRaw = req.params.repoId;
  const requestedPath = req.query.path;

  if (typeof repoIdRaw !== "string" || repoIdRaw.trim() === "") {
    return res.status(400).json({ error: "Invalid repository ID" });
  }

  if (typeof requestedPath !== "string" || requestedPath.trim() === "") {
    return res.status(400).json({ error: "path query parameter is required" });
  }

  const repoId = repoIdRaw;
  const filePath = requestedPath;

  try {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const fileRecord = await prisma.repoFile.findFirst({
      where: { repoId, path: filePath },
    });

    let content = fileRecord?.content ?? null;

    if (!content) {
      content = await getFileContent(repo.fullName, filePath, req.user.accessToken);

      if (!content) {
        return res.status(404).json({ error: "File not found" });
      }

      if (fileRecord) {
        await prisma.repoFile.update({
          where: { id: fileRecord.id },
          data: { content },
        });
      }
    }

    return res.json({
      path: filePath,
      name: fileRecord?.name ?? buildFileName(filePath),
      extension: fileRecord?.extension ?? null,
      size: fileRecord?.size ?? content.length,
      summary: fileRecord?.summary ?? null,
      content,
    });
  } catch (error) {
    console.error("getRepoFileContent failed", error);
    return res.status(500).json({ error: "Failed to fetch file contents" });
  }
};
