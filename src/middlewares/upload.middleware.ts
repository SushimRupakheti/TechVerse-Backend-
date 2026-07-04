import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/");
  },

  filename(req, file, cb) {
    cb(
      null,
      Date.now() + "-" + file.originalname.replace(/\s/g, "")
    );
  },
});

export const upload = multer({
  storage,
});
