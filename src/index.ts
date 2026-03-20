import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/auth";
import reposRoutes from "./routes/repos";
import indexRoutes from "./routes/index-repo";
import queryRoutes from "./routes/query";
import swaggerSpec from "./docs/swagger";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 5000);
const frontendUrl = process.env.FRONTEND_URL ??"https://stackmap-8ipx.vercel.app";

app.use(cors({ origin: frontendUrl }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRoutes);
app.use("/api/repos", reposRoutes);
app.use("/api/repos", indexRoutes);
app.use("/api/repos", queryRoutes);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "StackMap API running", timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled middleware error", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`StackMap API listening at http://localhost:${PORT}`);
});
