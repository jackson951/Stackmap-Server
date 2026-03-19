import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { indexRepository } from "../services/indexer.service";

export const indexRepo = async (req: AuthenticatedRequest, res: Response) => {
 const repoIdRaw = req.params.repoId;

if (Array.isArray(repoIdRaw)) {
  throw new Error("Invalid repoId");
}

const repoId = repoIdRaw;

  try {
    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
    });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const result = await indexRepository(repoId, req.user.accessToken as string);
    return res.json(result);
  } catch (error) {
    console.error("indexRepo failed", error);
    return res.status(500).json({ error: "Failed to index repository" });
  }
};

export const listRepoFiles = async (req: AuthenticatedRequest, res: Response) => {
  const repoIdRaw = req.params.repoId;

if (Array.isArray(repoIdRaw)) {
  throw new Error("Invalid repoId");
}

const repoId = repoIdRaw;

  try {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const files = await prisma.repoFile.findMany({
      where: { repoId },
      orderBy: { commitCount: "desc" },
      select: {
        path: true,
        name: true,
        extension: true,
        summary: true,
        commitCount: true,
      },
    });

    return res.json({ files });
  } catch (error) {
    console.error("listRepoFiles failed", error);
    return res.status(500).json({ error: "Failed to list files" });
  }
};
