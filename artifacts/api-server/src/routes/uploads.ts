import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const _jwtSecret = process.env.JWT_SECRET || "gsm-africa-jwt-secret-CHANGE-IN-PRODUCTION";

// Vercel Lambda's /var/task is read-only; use /tmp for writable storage.
// Locally (and on other hosts) use a sibling uploads/ directory.
const UPLOAD_DIR = process.env.VERCEL
  ? "/tmp/uploads"
  : path.join(process.cwd(), "uploads");

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch {
  // If we still can't create the dir, uploads will fail gracefully per-request
}

const MAX_SIZE_MB = 10;
const ALLOWED_MIME_PREFIXES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain", "application/zip"];
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".zip"]);

router.post("/uploads", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      jwt.verify(authHeader.slice(7), _jwtSecret);
    } catch {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_SIZE_MB * 1024 * 1024) {
        res.status(413).json({ error: `File too large (max ${MAX_SIZE_MB}MB)` });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (res.headersSent) return;

      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        res.status(400).json({ error: "Expected multipart/form-data" });
        return;
      }

      const boundary = contentType.split("boundary=")[1];
      if (!boundary) {
        res.status(400).json({ error: "No boundary in Content-Type" });
        return;
      }

      const body = Buffer.concat(chunks);
      const bodyStr = body.toString("binary");

      const boundaryStr = `--${boundary}`;
      const parts = bodyStr.split(boundaryStr).slice(1, -1);

      for (const part of parts) {
        const [headerSection, ...bodyParts] = part.split("\r\n\r\n");
        const headers = headerSection.toLowerCase();
        if (!headers.includes('name="file"')) continue;

        const fileBody = bodyParts.join("\r\n\r\n").replace(/\r\n$/, "");

        const mimeMatch = headerSection.match(/content-type:\s*([^\r\n]+)/i);
        const mime = mimeMatch ? mimeMatch[1].trim() : "application/octet-stream";

        const nameMatch = headerSection.match(/filename="([^"]+)"/i);
        const origName = nameMatch ? nameMatch[1] : "upload";
        const ext = path.extname(origName) || ".bin";

        const isAllowed = ALLOWED_MIME_PREFIXES.some(prefix => mime.startsWith(prefix));
        const extLower = ext.toLowerCase();
        if (!isAllowed || !ALLOWED_EXTENSIONS.has(extLower)) {
          res.status(415).json({ error: `File type not allowed: ${mime}` });
          return;
        }

        const safeExt = extLower;
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        fs.writeFileSync(filePath, Buffer.from(fileBody, "binary"));

        const basePath = process.env.BASE_PATH ?? "/api";
        const url = `${basePath}/uploads/${filename}`;
        res.status(201).json({ url, filename, mime, size: fileBody.length });
        return;
      }

      res.status(400).json({ error: "No file found in request" });
    });

    req.on("error", (err) => {
      req.log?.error({ err }, "Upload stream error");
      if (!res.headersSent) res.status(500).json({ error: "Upload failed" });
    });
  } catch (err) {
    req.log?.error({ err }, "Upload error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
  const filePath = path.join(UPLOAD_DIR, filename);

  // Prevent path traversal: verify the resolved path stays inside UPLOAD_DIR.
  // The regex above allows "." so ".." survives sanitisation; path.resolve
  // would then escape UPLOAD_DIR, so we must check explicitly.
  const resolvedDir = path.resolve(UPLOAD_DIR);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(filePath);
});

export default router;
