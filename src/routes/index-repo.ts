import { Router, Request, Response } from "express";
import { indexRepository } from "../services/indexer.service";
import { authGuard, AuthenticatedRequest } from "../middleware/auth";
import prisma from "../lib/prisma";

const router = Router();

router.use(authGuard);

router.post("/:repoId/index", async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;

    const repoId = String(req.params.repoId);
    const result = await indexRepository(repoId, user.accessToken);

    res.json(result);
  } catch (error) {
    console.error("indexRepository failed", error);
    res.status(500).json({ error: "Failed to index repository" });
  }
});

router.get("/:repoId/files", async (req: Request, res: Response) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const repoId = String(req.params.repoId);

    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
    });

    if (!repo || repo.userId !== user.id) {
      return res.status(404).json({ error: "Repo not found" });
    }

    // 🔥 Auto re-index if stale (e.g. older than 10 mins)
    const TEN_MINUTES = 10 * 60 * 1000;

    if (
      !repo.indexedAt ||
      Date.now() - new Date(repo.indexedAt).getTime() > TEN_MINUTES
    ) {
      console.log("Auto re-indexing repo...");
      await indexRepository(repoId, user.accessToken);
    }

    const files = await prisma.repoFile.findMany({
      where: { repoId },
      orderBy: { path: "asc" },
    });

    res.json({ files });
  } catch (error) {
    console.error("listRepoFiles failed", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});
export default router;