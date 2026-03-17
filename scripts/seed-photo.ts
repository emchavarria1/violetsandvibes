import fs from "node:fs";
import path from "node:path";

const PHOTO_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif", "svg"] as const;

export function resolveSeedPhotoPath(slug: string) {
  const assetDir = path.join(process.cwd(), "public", "seed-avatars");

  for (const extension of PHOTO_EXTENSIONS) {
    const filename = `${slug}.${extension}`;
    const fullPath = path.join(assetDir, filename);
    if (fs.existsSync(fullPath)) {
      return `/seed-avatars/${filename}`;
    }
  }

  return `/seed-avatars/${slug}.svg`;
}

