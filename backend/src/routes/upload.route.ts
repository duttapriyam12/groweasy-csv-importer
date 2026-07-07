import { Router, Request, Response } from "express";
import multer from "multer";
import { parseCsv } from "../services/csvParser.service";
import { extractCrmRecords, getTotalBatches } from "../services/aiExtractor.service";
import {
  createJob,
  incrementJobProgress,
  completeJob,
  failJob,
  getJob,
} from "../utils/jobStore.util";

const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES) || 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv");
    if (!isCsv) {
      return cb(new Error("Only .csv files are supported."));
    }
    cb(null, true);
  },
});

const router = Router();


router.post("/upload/start", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
    }

    const csvText = req.file.buffer.toString("utf-8");
    const rawRecords = parseCsv(csvText);
    const totalBatches = getTotalBatches(rawRecords);
    const jobId = createJob(totalBatches);


    extractCrmRecords(rawRecords, () => incrementJobProgress(jobId))
      .then((result) => completeJob(jobId, result))
      .catch((err) => failJob(jobId, err instanceof Error ? err.message : "Processing failed."));

    return res.status(200).json({ jobId, totalBatches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return res.status(400).json({ error: message });
  }
});


router.get("/upload/status/:jobId", (req: Request, res: Response) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found or expired." });
  }
  return res.status(200).json({
    status: job.status,
    completedBatches: job.completedBatches,
    totalBatches: job.totalBatches,
    result: job.status === "done" ? job.result : null,
    error: job.error,
  });
});

export default router;