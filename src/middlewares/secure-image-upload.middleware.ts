import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextFunction, Request, Response } from "express";
import multer from "multer";

const FIVE_MB = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const PRIVATE_UPLOAD_ROOT = path.resolve(process.cwd(), "private-uploads", "images");

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const DANGEROUS_EXTENSIONS = new Set([
  ".asp", ".aspx", ".bat", ".bin", ".cmd", ".com", ".cpl", ".dll",
  ".exe", ".gadget", ".hta", ".html", ".jar", ".js", ".jsp", ".msi",
  ".php", ".phtml", ".ps1", ".py", ".rb", ".sh", ".svg", ".vb", ".vbs",
]);

export type StoredImage = {
  fieldName: string;
  originalMimeType: string;
  fileName: string;
  storagePath: string;
  size: number;
  url: string;
};

declare global {
  namespace Express {
    interface Request {
      storedImages?: StoredImage[];
    }
  }
}

function logUploadFailure(req: Request, reason: string) {
  // Generic response to clients, detailed reason to server logs for auditing.
  console.warn("[secure-upload] rejected", {
    reason,
    userId: (req.user as any)?._id?.toString(),
    ip: req.ip,
    path: req.originalUrl,
  });
}

function sanitizeOriginalName(originalName: string) {
  // Drop any user-supplied path to block directory traversal attempts.
  return path.basename(originalName || "").replace(/\0/g, "");
}

function hasDangerousOrDoubleExtension(originalName: string) {
  const safeName = sanitizeOriginalName(originalName).toLowerCase();
  const parts = safeName.split(".").filter(Boolean);

  // Reject double extensions like image.jpg.php. We never trust extensions for type checks,
  // but rejecting them removes a common bypass and social-engineering pattern.
  if (parts.length > 2) return true;

  return parts.some((part, index) => index > 0 && DANGEROUS_EXTENSIONS.has(`.${part}`));
}

function isJpeg(buffer: Buffer) {
  if (buffer.length < 4) return false;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return false;

  // Parse JPEG markers enough to verify the image has a real SOF dimensions segment.
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) return false;
    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd9) return true;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return false;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return false;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      if (segmentLength < 7) return false;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width > 0 && height > 0;
    }

    offset += segmentLength;
  }

  return false;
}

function isPng(buffer: Buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) return false;

  let offset = 8;
  let sawIhdr = false;
  let sawIdat = false;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > buffer.length) return false;

    if (!sawIhdr && type !== "IHDR") return false;
    if (type === "IHDR") {
      if (length !== 13 || sawIhdr) return false;
      const width = buffer.readUInt32BE(dataStart);
      const height = buffer.readUInt32BE(dataStart + 4);
      if (width === 0 || height === 0) return false;
      sawIhdr = true;
    }
    if (type === "IDAT") sawIdat = true;
    if (type === "IEND") return sawIhdr && sawIdat && crcEnd === buffer.length;

    offset = crcEnd;
  }

  return false;
}

function isWebp(buffer: Buffer) {
  if (buffer.length < 16) return false;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return false;
  if (buffer.toString("ascii", 8, 12) !== "WEBP") return false;

  const riffSize = buffer.readUInt32LE(4);
  if (riffSize + 8 > buffer.length) return false;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const paddedSize = chunkSize + (chunkSize % 2);
    const nextOffset = dataStart + paddedSize;
    if (nextOffset > buffer.length) return false;

    if (chunkType === "VP8 " && chunkSize >= 10) return true;
    if (chunkType === "VP8L" && chunkSize >= 5) return true;
    if (chunkType === "VP8X" && chunkSize >= 10) {
      const widthMinusOne = buffer.readUIntLE(dataStart + 4, 3);
      const heightMinusOne = buffer.readUIntLE(dataStart + 7, 3);
      return widthMinusOne >= 0 && heightMinusOne >= 0;
    }

    offset = nextOffset;
  }

  return false;
}

function detectImageMimeFromMagicBytes(buffer: Buffer) {
  if (isJpeg(buffer)) return "image/jpeg";
  if (isPng(buffer)) return "image/png";
  if (isWebp(buffer)) return "image/webp";
  return null;
}

function stripJpegMetadata(buffer: Buffer) {
  // Removes APPn and COM segments, including common EXIF/XMP metadata containers.
  if (!isJpeg(buffer)) return buffer;

  const chunks: Buffer[] = [buffer.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) return buffer;
    const marker = buffer[offset + 1];

    if (marker === 0xda) {
      chunks.push(buffer.subarray(offset));
      return Buffer.concat(chunks);
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) return buffer;

    const isMetadataSegment = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadataSegment) chunks.push(buffer.subarray(offset, offset + 2 + segmentLength));
    offset += 2 + segmentLength;
  }

  return buffer;
}

function stripPngMetadata(buffer: Buffer) {
  // Keeps critical chunks and drops ancillary chunks that may carry metadata, such as eXIf/iTXt/tEXt/zTXt.
  if (!isPng(buffer)) return buffer;
  const chunks: Buffer[] = [buffer.subarray(0, 8)];
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const crcEnd = offset + 12 + length;
    if (crcEnd > buffer.length) return buffer;

    const isCritical = /^[A-Z]{4}$/.test(type);
    if (isCritical || type === "tRNS") chunks.push(buffer.subarray(offset, crcEnd));
    if (type === "IEND") break;
    offset = crcEnd;
  }

  return Buffer.concat(chunks);
}

function stripWebpMetadata(buffer: Buffer) {
  // Rewrites the RIFF container without EXIF/XMP/ICCP chunks where possible.
  if (!isWebp(buffer)) return buffer;
  const chunks: Buffer[] = [];
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const paddedSize = chunkSize + (chunkSize % 2);
    const nextOffset = dataStart + paddedSize;
    if (nextOffset > buffer.length) return buffer;

    if (!["EXIF", "XMP ", "ICCP"].includes(chunkType)) {
      chunks.push(buffer.subarray(offset, nextOffset));
    }
    offset = nextOffset;
  }

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, body]);
}

function stripMetadata(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return stripJpegMetadata(buffer);
  if (mimeType === "image/png") return stripPngMetadata(buffer);
  if (mimeType === "image/webp") return stripWebpMetadata(buffer);
  return buffer;
}

async function ensureUploadRoot() {
  await fs.promises.mkdir(PRIVATE_UPLOAD_ROOT, { recursive: true });
}

export const secureImageUpload = multer({
  // Store in memory first so validation happens before anything touches disk.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FIVE_MB,
    files: MAX_IMAGES,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      logUploadFailure(req, "blocked MIME type");
      return cb(new Error("Invalid image upload."));
    }

    if (hasDangerousOrDoubleExtension(file.originalname)) {
      logUploadFailure(req, "dangerous or double extension");
      return cb(new Error("Invalid image upload."));
    }

    return cb(null, true);
  },
});

export function handleUploadErrors(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (!error) return next();

  if (error instanceof multer.MulterError) {
    logUploadFailure(req, error.code);
    const message = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT"
      ? "Upload limit exceeded."
      : "Invalid image upload.";
    return res.status(400).json({ success: false, message });
  }

  logUploadFailure(req, error instanceof Error ? error.message : "unknown upload error");
  return res.status(400).json({ success: false, message: "Invalid image upload." });
}

export async function validateAndStoreImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = normalizeFiles(req.files ?? req.file);
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "No image uploaded." });
    }
    if (files.length > MAX_IMAGES) {
      logUploadFailure(req, "too many files");
      return res.status(400).json({ success: false, message: "Upload limit exceeded." });
    }

    await ensureUploadRoot();
    const storedImages: StoredImage[] = [];

    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        logUploadFailure(req, "empty file");
        return res.status(400).json({ success: false, message: "Invalid image upload." });
      }

      const detectedMimeType = detectImageMimeFromMagicBytes(file.buffer);
      if (!detectedMimeType || detectedMimeType !== file.mimetype) {
        logUploadFailure(req, "magic bytes did not match MIME type");
        return res.status(400).json({ success: false, message: "Invalid image upload." });
      }

      const cleanedBuffer = stripMetadata(file.buffer, detectedMimeType);
      if (!detectImageMimeFromMagicBytes(cleanedBuffer)) {
        logUploadFailure(req, "image parser rejected cleaned file");
        return res.status(400).json({ success: false, message: "Invalid image upload." });
      }

      const fileName = `${crypto.randomUUID()}${EXTENSION_BY_MIME[detectedMimeType]}`;
      const storagePath = path.join(PRIVATE_UPLOAD_ROOT, fileName);
      if (!storagePath.startsWith(PRIVATE_UPLOAD_ROOT)) {
        logUploadFailure(req, "path traversal attempt");
        return res.status(400).json({ success: false, message: "Invalid image upload." });
      }

      await fs.promises.writeFile(storagePath, cleanedBuffer, { flag: "wx", mode: 0o600 });
      storedImages.push({
        fieldName: file.fieldname,
        originalMimeType: detectedMimeType,
        fileName,
        storagePath,
        size: cleanedBuffer.length,
        url: `/api/uploads/images/${fileName}`,
      });
    }

    req.storedImages = storedImages;
    return next();
  } catch (error) {
    logUploadFailure(req, error instanceof Error ? error.message : "store failure");
    return res.status(400).json({ success: false, message: "Invalid image upload." });
  }
}

function normalizeFiles(
  files: Express.Multer.File[] | Express.Multer.File | { [fieldname: string]: Express.Multer.File[] } | undefined
): Express.Multer.File[] {
  if (!files) return [];
  if (Array.isArray(files)) return files;

  const maybeFile = files as Express.Multer.File;
  if (Buffer.isBuffer(maybeFile.buffer)) return [maybeFile];

  return Object.values(files as { [fieldname: string]: Express.Multer.File[] }).flat();
}