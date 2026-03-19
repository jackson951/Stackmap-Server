import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("Missing JWT_SECRET environment variable");
}

interface JwtPayload {
  userId: string;
  githubId: string;
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    githubId: string;
    accessToken: string;
  };
}

export const authGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    (req as AuthenticatedRequest).user = {
      id: user.id,
      githubId: user.githubId,
      accessToken: user.accessToken,
    };

    next();
  } catch (error) {
    console.error("authGuard failed", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};
