import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { AppError } from './errorHandler.js';

// Use memory storage for quick in-memory parsing without leaving lingering temp files
const storage = multer.memoryStorage();

const createBadFileError = (filename: string, allowedDesc: string): AppError => {
  const ext = path.extname(filename).toLowerCase() || '(no extension)';
  const err: AppError = new Error(
    `Unsupported file type "${ext}". Only ${allowedDesc} files are supported.`
  );
  err.statusCode = 400;
  err.code = 'UNSUPPORTED_FILE_TYPE';
  return err;
};

const documentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const lower = file.originalname.toLowerCase();
  const isPdf = file.mimetype === 'application/pdf' || lower.endsWith('.pdf');
  const isDocx =
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx');

  if (isPdf || isDocx) {
    cb(null, true);
  } else {
    cb(createBadFileError(file.originalname, 'PDF (.pdf) and Word (.docx)'));
  }
};

const pdfOnlyFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const lower = file.originalname.toLowerCase();
  if (file.mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(createBadFileError(file.originalname, 'PDF (.pdf)'));
  }
};

const docxOnlyFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const lower = file.originalname.toLowerCase();
  if (
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    cb(null, true);
  } else {
    cb(createBadFileError(file.originalname, 'Word (.docx)'));
  }
};

const zipOnlyFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const lower = file.originalname.toLowerCase();
  if (
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-zip-compressed' ||
    lower.endsWith('.zip')
  ) {
    cb(null, true);
  } else {
    cb(createBadFileError(file.originalname, 'ZIP (.zip)'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    files: 30,
  },
  fileFilter: documentFileFilter,
});

export const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 30,
  },
  fileFilter: pdfOnlyFilter,
});

export const uploadDocx = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 30,
  },
  fileFilter: docxOnlyFilter,
});

export const uploadZip = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max ZIP archive
    files: 1,
  },
  fileFilter: zipOnlyFilter,
});
