import { Router } from "express";
import { githubRedirect, githubCallback, getCurrentUser } from "../controllers/auth.controller";
import { authGuard } from "../middleware/auth";

const router = Router();

router.get("/github", githubRedirect as any);
router.get("/github/callback", githubCallback as any);
router.get("/me", authGuard, getCurrentUser as any);

export default router;
