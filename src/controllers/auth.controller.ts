import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import prisma from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 5000}`;
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
const jwtSecret = process.env.JWT_SECRET;

if (!githubClientId || !githubClientSecret) {
  throw new Error("Missing GitHub OAuth credentials (GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET)");
}

if (!jwtSecret) {
  throw new Error("Missing JWT_SECRET environment variable");
}

export const githubRedirect = (_req: Request, res: Response) => {
  const callbackUrl = `${backendUrl}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: githubClientId,
    redirect_uri: callbackUrl,
    scope: "repo read:user user:email",
    allow_signup: "true",
  });

  return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};

export const githubCallback = async (req: Request, res: Response) => {
  const code = String(req.query.code || "");

  if (!code) {
    return res.status(400).json({ error: "Missing code from GitHub" });
  }

  try {
    const callbackUrl = `${backendUrl}/api/auth/github/callback`;

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: githubClientId,
        client_secret: githubClientSecret,
        code,
        redirect_uri: callbackUrl,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.status(400).json({ error: "Unable to retrieve access token from GitHub" });
    }

    const profileResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const githubId = String(profileResponse.data.id);
    const username = profileResponse.data.login;
    const avatarUrl = profileResponse.data.avatar_url;
    let email = profileResponse.data.email;

    if (!email) {
      const emailResponse = await axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const primaryEmail = emailResponse.data.find((entry: any) => entry.primary && entry.verified);
      email = primaryEmail?.email ?? emailResponse.data[0]?.email ?? null;
    }

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

    const token = jwt.sign({ userId: user.id, githubId: user.githubId }, jwtSecret, { expiresIn: "24h" });

    return res.redirect(`${frontendUrl}/dashboard?token=${token}`);
  } catch (error) {
    console.error("GitHub callback failed", error);
    return res.status(500).json({ error: "Failed to complete GitHub OAuth flow" });
  }
};

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response) => {
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
