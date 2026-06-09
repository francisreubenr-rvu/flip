import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getServerClient, isSupabaseConfigured } from "@/lib/ledger/supabase-server";

/**
 * Storage bucket used for statement PDFs / markdown source files.
 */
const BUCKET_NAME = "statements";

/**
 * Local filesystem directory used when Supabase Storage is unavailable.
 */
const LOCAL_STORAGE_DIR = `${process.cwd()}/need-welp/statements`;

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a statement file to Supabase Storage (bucket: `statements`).
 *
 * Path format: `uploads/{filename}`
 *
 * Falls back to the local `need-welp/statements/` directory when Supabase
 * Storage is not available.
 *
 * @returns The public URL (Supabase) or relative path (filesystem), or `null`
 *          on failure.
 */
export async function uploadStatement(
  file: File | Buffer,
  filename: string,
): Promise<string | null> {
  const objectPath = `uploads/${filename}`;

  // -- Supabase path ---------------------------------------------------------
  if (isSupabaseConfigured()) {
    const supabase = getServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(objectPath, file, {
            upsert: true,
            contentType: filename.endsWith(".pdf")
              ? "application/pdf"
              : "text/markdown",
          });

        if (error) throw error;

        // Return the public URL.
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(objectPath);

        return publicUrlData?.publicUrl ?? null;
      } catch (err) {
        console.warn(
          "[ledger/storage] Supabase upload failed, falling back to filesystem:",
          err instanceof Error ? err.message : err,
        );
        // Fall through to filesystem fallback.
      }
    }
  }

  // -- Filesystem fallback ---------------------------------------------------
  try {
    // Ensure the local storage directory exists.
    if (!existsSync(LOCAL_STORAGE_DIR)) {
      await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
    }

    const destPath = path.join(LOCAL_STORAGE_DIR, filename);
    let buffer: Buffer;
    if (Buffer.isBuffer(file)) {
      buffer = file;
    } else {
      buffer = Buffer.from(await (file as File).arrayBuffer());
    }
    await writeFile(destPath, buffer);

    return `need-welp/statements/${filename}`;
  } catch (fsErr) {
    console.error(
      "[ledger/storage] Filesystem fallback also failed:",
      fsErr instanceof Error ? fsErr.message : fsErr,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Download a statement file from Supabase Storage.
 *
 * @param path The object path (e.g. `uploads/statement-2024-01.pdf`) or a
 *             local relative path (e.g. `need-welp/statements/...`).
 * @returns The file contents as a Buffer, or `null` on failure.
 */
export async function downloadStatement(
  objectPath: string,
): Promise<Buffer | null> {
  // -- Supabase path ---------------------------------------------------------
  if (isSupabaseConfigured()) {
    const supabase = getServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .download(objectPath);

        if (error) throw error;
        if (!data) return null;

        const blob: Blob = data as Blob;
        const arrayBuffer = await blob.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (err) {
        console.warn(
          "[ledger/storage] Supabase download failed, falling back to filesystem:",
          err instanceof Error ? err.message : err,
        );
        // Fall through to filesystem fallback.
      }
    }
  }

  // -- Filesystem fallback ---------------------------------------------------
  try {
    // If the path looks like a Supabase path, attempt the local equivalent.
    const localPath = objectPath.startsWith("need-welp/")
      ? `${process.cwd()}/${objectPath}`
      : path.join(LOCAL_STORAGE_DIR, path.basename(objectPath));

    const buffer = await readFile(localPath);
    return buffer;
  } catch (fsErr) {
    console.error(
      "[ledger/storage] Filesystem fallback also failed:",
      fsErr instanceof Error ? fsErr.message : fsErr,
    );
    return null;
  }
}
