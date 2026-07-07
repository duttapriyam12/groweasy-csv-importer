import "dotenv/config";   // ← must be the first line in the whole file

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import uploadRouter from "./routes/upload.route";
console.log("DEBUG - Model being used:", process.env.OPENAI_MODEL);
console.log("DEBUG - Groq key present:", !!process.env.GROQ_API_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api", uploadRouter);

// Centralized error handler (e.g. multer file-size errors land here too).
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const message = err?.message || "Internal server error.";
  res.status(400).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`GrowEasy CSV Importer backend running on http://localhost:${PORT}`);
});
