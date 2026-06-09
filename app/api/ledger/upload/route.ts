import { NextRequest, NextResponse } from 'next/server';
import { writeFile, access } from 'fs/promises';
import path from 'path';
import { isSupabaseConfigured } from '@/lib/ledger/supabase-server';
import { uploadStatement } from '@/lib/ledger/storage';

const ALLOWED_EXTENSIONS = ['.xlsx', '.pdf'];
const NEED_WELP_DIR = path.join(process.cwd(), 'need-welp');

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: 'Only .xlsx and .pdf files are accepted' },
        { status: 400 },
      );
    }

    const today = getToday();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Use Supabase Storage when available
    if (isSupabaseConfigured()) {
      try {
        const filePath = await uploadStatement(buffer, `statement-${today}${ext}`);
        if (!filePath) {
          throw new Error('Upload returned no file path');
        }
        return NextResponse.json({
          success: true,
          filePath,
          filename: `statement-${today}${ext}`,
        });
      } catch (supabaseError) {
        // Fall through to filesystem fallback
        console.warn('Supabase upload failed, falling back to filesystem:', supabaseError);
      }
    }

    // Filesystem fallback
    let filename = `statement-${today}${ext}`;
    let filePath = path.join(NEED_WELP_DIR, filename);

    try {
      await access(filePath);
      // File exists — append timestamp to avoid collision
      const timeStr = getTimestamp();
      filename = `statement-${today}-${timeStr}${ext}`;
      filePath = path.join(NEED_WELP_DIR, filename);
    } catch {
      // File does not exist — use the original name
    }

    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      filePath: `/need-welp/${filename}`,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
