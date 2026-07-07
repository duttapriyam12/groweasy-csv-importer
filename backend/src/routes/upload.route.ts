import { Router, Request, Response } from "express";
import multer from "multer";
import { parseCsv } from "../services/csvParser.service";
import { extractCrmRecords } from "../services/aiExtractor.service";

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

router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
    }

    const csvText = req.file.buffer.toString("utf-8");
    const rawRecords = parseCsv(csvText);

    const result = await extractCrmRecords(rawRecords);

    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return res.status(400).json({ error: message });
  }
});

export default router;
