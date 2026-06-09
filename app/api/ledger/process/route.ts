import { NextRequest, NextResponse } from 'next/server';
import { writeFile, access, mkdtemp } from 'fs/promises';
import path from 'path';
import os from 'os';
import { parseFile } from '@/lib/ledger/parser';
import { cleanStatement } from '@/lib/ledger/cleaner';
import { isSupabaseConfigured } from '@/lib/ledger/supabase-server';
import { downloadStatement } from '@/lib/ledger/storage';
import type { Statement } from '@/lib/ledger/types';

const NEED_WELP_DIR = path.join(process.cwd(), 'need-welp');

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { filePath: string };

    if (!body.filePath || typeof body.filePath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'filePath is required' },
        { status: 400 },
      );
    }

    let resolvedPath: string;

    // Handle Supabase storage paths
    if (body.filePath.startsWith('supabase://')) {
      if (!isSupabaseConfigured()) {
        return NextResponse.json(
          { success: false, error: 'Supabase is not configured but filePath references supabase://' },
          { status: 500 },
        );
      }

      try {
        // Download from Supabase Storage to a temp file
        const storagePath = body.filePath.replace('supabase://', '');
        const fileBuffer = await downloadStatement(storagePath);
        if (!fileBuffer) {
          throw new Error('Download failed — file not found in storage');
        }
        const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ledger-'));
        const ext = path.extname(storagePath) || '.xlsx';
        const tmpFile = path.join(tmpDir, `statement${ext}`);
        await writeFile(tmpFile, fileBuffer);
        resolvedPath = tmpFile;
      } catch (dlError) {
        const message = dlError instanceof Error ? dlError.message : 'Failed to download from Supabase';
        return NextResponse.json(
          { success: false, error: `File not found in storage: ${message}` },
          { status: 404 },
        );
      }
    } else {
      // Resolve the relative /need-welp/ path to the actual filesystem path
      const filename = path.basename(body.filePath);
      resolvedPath = path.join(NEED_WELP_DIR, filename);

      // Verify the file exists
      try {
        await access(resolvedPath);
      } catch {
        return NextResponse.json(
          { success: false, error: `File not found: ${body.filePath}` },
          { status: 404 },
        );
      }
    }

    // Parse the statement file
    const result = await parseFile(resolvedPath);

    // Clean the raw markdown
    const cleanedMarkdown = cleanStatement(result.rawMarkdown);

    // Write cleaned markdown to disk (filesystem is fine — this output is transient)
    const outputFilename = `statement-${new Date().toISOString().split('T')[0]}.md`;
    const outputPath = path.join(NEED_WELP_DIR, outputFilename);
    await writeFile(outputPath, cleanedMarkdown, 'utf-8');

    const statement: Statement = result.statement;

    return NextResponse.json({
      success: true,
      statement,
      cleanedMarkdown,
      outputPath: `/need-welp/${outputFilename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    const status =
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('no such file')
        ? 404
        : 422;
    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}
