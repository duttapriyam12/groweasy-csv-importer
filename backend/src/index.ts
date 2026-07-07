import "dotenv/config";   

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import uploadRouter from "./routes/upload.route";


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


app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const message = err?.message || "Internal server error.";
  res.status(400).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`GrowEasy CSV Importer backend running on http://localhost:${PORT}`);
});
