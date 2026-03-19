import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const backendUrl =
  process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 5000}`;
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
const jwtSecret = process.env.JWT_SECRET;

if (!githubClientId || !githubClientSecret) {
  throw new Error(
    "Missing GitHub OAuth credentials (GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET)"
  );
}

if (!jwtSecret) {
  throw new Error("Missing JWT_SECRET environment variable");
}

/**
 * STEP 1: Redirect user to GitHub
 */
export const githubRedirect = (_req: Request, res: Response) => {
  const callbackUrl = `${backendUrl}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: githubClientId,
    redirect_uri: callbackUrl,
    scope: "repo read:user user:email",
    allow_signup: "true",
  });

  return res.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
};

/**
 * STEP 2: GitHub redirects back here
 */
export const githubCallback = async (req: Request, res: Response) => {
  const code = String(req.query.code || "");

  if (!code) {
    return res.redirect(`${frontendUrl}/auth/error?message=missing_code`);
  }

  try {
    const callbackUrl = `${backendUrl}/api/auth/github/callback`;

    /**
     * Exchange code for access token
     */
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: githubClientId,
        client_secret: githubClientSecret,
        code,
        redirect_uri: callbackUrl,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.redirect(`${frontendUrl}/auth/error?message=no_access_token`);
    }

    /**
     * Get GitHub user profile
     */
    const profileResponse = await axios.get(
      "https://api.github.com/user",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const githubId = String(profileResponse.data.id);
    const username = profileResponse.data.login;
    const avatarUrl = profileResponse.data.avatar_url;
    let email = profileResponse.data.email;

    /**
     * Fallback to emails endpoint if email is null
     */
    if (!email) {
      const emailResponse = await axios.get(
        "https://api.github.com/user/emails",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const primaryEmail = emailResponse.data.find(
        (entry: any) => entry.primary && entry.verified
      );

      email =
        primaryEmail?.email ??
        emailResponse.data[0]?.email ??
        null;
    }

    /**
     * Upsert user in DB
     */
    const user = await prisma.user.upsert({
      where: { githubId },
      update: {
        username,
        email,
        avatarUrl,
        accessToken,
      },
      create: {
        githubId,
        username,
        email,
        avatarUrl,
        accessToken,
      },
    });

    /**
     * Generate JWT
     */
    const token = jwt.sign(
      { userId: user.id, githubId: user.githubId },
      jwtSecret,
      { expiresIn: "24h" }
    );

    /**
     * ✅ IMPORTANT: Redirect to frontend callback page
     */
    return res.redirect(
      `${frontendUrl}/auth/callback?token=${token}`
    );

  } catch (error) {
    console.error("GitHub callback failed", error);
    return res.redirect(`${frontendUrl}/auth/error?message=oauth_failed`);
  }
};

/**
 * STEP 3: Get current user (protected route)
 */
export const getCurrentUser = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        githubId: true,
        username: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error("getCurrentUser failed", error);
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

/**
 * Delete user account and all associated data
 */
export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user.id;

    // Delete all related data in the correct order to avoid foreign key constraint issues
    await prisma.$transaction([
      // Delete queries first (they reference both user and repo)
      prisma.query.deleteMany({
        where: { userId },
      }),
      // Delete repo files (they reference repo)
      prisma.repoFile.deleteMany({
        where: {
          repo: {
            userId,
          },
        },
      }),
      // Delete repos
      prisma.repo.deleteMany({
        where: { userId },
      }),
      // Finally delete the user
      prisma.user.delete({
        where: { id: userId },
      }),
    ]);

    return res.json({ 
      success: true, 
      message: "Account and all associated data have been permanently deleted" 
    });
  } catch (error) {
    console.error("deleteAccount failed", error);
    return res.status(500).json({ error: "Failed to delete account" });
  }
};
