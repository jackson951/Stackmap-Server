import { Router } from "express";
import { listRepos, connectRepo, deleteRepo } from "../controllers/repos.controller";
import { authGuard } from "../middleware/auth";

const router = Router();

router.use(authGuard);

router.get("/", listRepos as any);
router.post("/connect", connectRepo as any);
router.delete("/:repoId", deleteRepo as any);

export default router;
