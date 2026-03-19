import { Router } from "express";
import { queryRepository, listQueries, generateGuide } from "../controllers/query.controller";
import { authGuard } from "../middleware/auth";

const router = Router();

router.use(authGuard);

router.post("/:repoId/query", queryRepository as any);
router.get("/:repoId/queries", listQueries as any);
router.post("/:repoId/guide", generateGuide as any);

export default router;