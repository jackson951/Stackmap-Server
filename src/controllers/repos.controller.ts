import { Response } from "express";
import prisma from "../lib/prisma";
import { verifyRepoExists } from "../services/github.service";
import { AuthenticatedRequest } from "../middleware/auth";
import axios from "axios";
interface GitHubRepo {
  githubRepoId: string;
  name: string;
  fullName: string;
  description?: string | null;
  language?: string | null;
  htmlUrl: string;
}

export const listRepos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accessToken = req.user.accessToken;
    if (!accessToken) {
      return res.status(400).json({ error: "No GitHub access token found" });
    }

    // Fetch GitHub repos
    const githubResponse = await axios.get("https://api.github.com/user/repos", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 100, sort: "updated" },
    });

    const githubRepos: GitHubRepo[] = githubResponse.data.map((repo: any) => ({
      githubRepoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      language: repo.language,
      htmlUrl: repo.html_url,
    }));

    // Fetch DB repos for this user
    const dbRepos = await prisma.repo.findMany({ where: { userId: req.user.id } });
    const dbRepoMap = new Map(dbRepos.map(r => [r.githubRepoId, r]));

    // Upsert GitHub repos into DB
    const upsertPromises = githubRepos.map((repo: GitHubRepo) => {
      const existing = dbRepoMap.get(repo.githubRepoId);

      if (existing) {
        // Update if any changes
        if (
          existing.name !== repo.name ||
          existing.fullName !== repo.fullName ||
          existing.description !== repo.description ||
          existing.language !== repo.language
        ) {
          return prisma.repo.update({
            where: { id: existing.id },
            data: {
              name: repo.name,
              fullName: repo.fullName,
              description: repo.description,
              language: repo.language,
            },
          });
        }
        return null; // no changes
      } else {
        // Insert new repo
        return prisma.repo.create({
          data: {
            userId: req.user.id,
            githubRepoId: repo.githubRepoId,
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
          },
        });
      }
    });

    await Promise.all(upsertPromises.filter(Boolean));

    // Return updated DB repos
    const finalRepos = await prisma.repo.findMany({ where: { userId: req.user.id } });
    return res.json({ repos: finalRepos });
  } catch (error) {
    console.error("listRepos failed", error);
    return res.status(500).json({ error: "Failed to list GitHub repositories" });
  }
};
// ---------------------- CONNECT REPO ----------------------
export const connectRepo = async (req: AuthenticatedRequest, res: Response) => {
  const { fullName } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: "fullName is required" });
  }

  try {
    const existing = await prisma.repo.findFirst({
      where: {
        userId: req.user.id,
        fullName,
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Repo already connected" });
    }

    const repoInfo = await verifyRepoExists(fullName, req.user.accessToken as string);

    const repo = await prisma.repo.create({
      data: {
        userId: req.user.id,
        githubRepoId: String(repoInfo.id),
        name: repoInfo.name,
        fullName: repoInfo.full_name,
        description: repoInfo.description,
        language: repoInfo.language,
      },
    });

    return res.status(201).json({ repo });
  } catch (error) {
    console.error("connectRepo failed", error);
    return res.status(500).json({ error: "Failed to connect repository" });
  }
};

// ---------------------- DELETE REPO ----------------------
export const deleteRepo = async (req: AuthenticatedRequest, res: Response) => {
  const repoIdRaw = req.params.repoId;

  if (typeof repoIdRaw !== "string") {
    return res.status(400).json({ error: "Invalid repository ID" });
  }

  const repoId = repoIdRaw;

  try {
    const repo = await prisma.repo.findUnique({ where: { id: repoId } });

    if (!repo || repo.userId !== req.user.id) {
      return res.status(404).json({ error: "Repository not found" });
    }

    await prisma.$transaction([
      prisma.repoFile.deleteMany({ where: { repoId } }),
      prisma.query.deleteMany({ where: { repoId } }),
      prisma.repo.delete({ where: { id: repoId } }),
    ]);

    return res.json({ success: true });
  } catch (error) {
    console.error("deleteRepo failed", error);
    return res.status(500).json({ error: "Failed to delete repository" });
  }
};