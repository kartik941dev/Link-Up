import multer from 'multer';
import { Request } from 'express';

// Use memory storage for quick in-memory parsing without leaving lingering temp files
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const isPdf =
    file.mimetype === 'application/pdf' ||
    file.originalname.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.mimetype === 'application/msword' ||
    file.originalname.toLowerCase().endsWith('.docx');

  if (isPdf || isDocx) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only PDF (.pdf) and Word documents (.docx) are supported.'
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter,
});
