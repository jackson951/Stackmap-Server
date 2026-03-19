import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { queryRepo as askClaude, generateGuide as onboardGuide } from "../services/ai.service";

export const queryRepository = async (req: AuthenticatedRequest, res: Response) => {
  const repoIdRaw = req.params.repoId;
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  // Ensure repoId is a string, not an array
  if (typeof repoIdRaw !== 'string') {
    return res.status(400).json({ error: "Invalid repository ID" });
  }

  const repoId = repoIdRaw;

  try {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const files = await prisma.repoFile.findMany({
      where: { repoId },
      select: { path: true, summary: true },
    });

    const { answer, filesReferenced } = await askClaude(question, files);

    const query = await prisma.query.create({
      data: {
        userId: req.user.id,
        repoId,
        question,
        answer,
        filesReferenced,
      },
    });

    return res.json({ answer, filesReferenced, queryId: query.id });
  } catch (error) {
    console.error("queryRepository failed", error);
    return res.status(500).json({ error: "Failed to run query" });
  }
};

export const listQueries = async (req: AuthenticatedRequest, res: Response) => {
  const repoIdRaw = req.params.repoId;

  // Ensure repoId is a string, not an array
  if (typeof repoIdRaw !== 'string') {
    return res.status(400).json({ error: "Invalid repository ID" });
  }

  const repoId = repoIdRaw;

  try {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const queries = await prisma.query.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ queries });
  } catch (error) {
    console.error("listQueries failed", error);
    return res.status(500).json({ error: "Failed to list queries" });
  }
};

export const generateGuide = async (req: AuthenticatedRequest, res: Response) => {
  const repoIdRaw = req.params.repoId;

  // Ensure repoId is a string, not an array
  if (typeof repoIdRaw !== 'string') {
    return res.status(400).json({ error: "Invalid repository ID" });
  }

  const repoId = repoIdRaw;

  try {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const files = await prisma.repoFile.findMany({
      where: { repoId },
      select: { path: true, summary: true },
    });

    const guide = await onboardGuide(files);
    return res.json({ guide });
  } catch (error) {
    console.error("generateGuide failed", error);
    return res.status(500).json({ error: "Failed to generate guide" });
  }
};