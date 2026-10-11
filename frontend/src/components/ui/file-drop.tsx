'use client';

import { useRef, useState, type DragEvent } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FileDropProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string[];
  maxBytes: number;
  error?: string;
  disabled?: boolean;
}

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Drag-and-drop or click-to-choose file field with type and size checks before upload. */
export function FileDrop({ file, onFile, accept, maxBytes, error, disabled }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string>();

  function take(f: File | undefined) {
    if (!f) return;
    const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
    if (!accept.includes(ext)) {
      setLocalError(ext === '.xls' ? 'Old .xls files are not supported. Save it as .xlsx in Excel first.' : `Choose a ${accept.join(' or ')} file.`);
      return;
    }
    if (f.size > maxBytes) {
      setLocalError(`The file is ${size(f.size)}; the limit is ${size(maxBytes)}. Split it into smaller files.`);
      return;
    }
    setLocalError(undefined);
    onFile(f);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files[0]);
  };

  const shownError = localError ?? error;

  if (file) {
    return (
      <div className={cn('flex items-center gap-3 rounded-panel border bg-surface px-4 py-3.5', shownError ? 'border-rose' : 'border-line')}>
        <FileSpreadsheet className="size-8 flex-none text-fjord" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-xs text-ink-3">{size(file.size)}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onFile(null)} className="rounded-md p-1.5 text-ink-3 hover:bg-mist hover:text-ink" aria-label="Remove file">
            <X className="size-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-panel border-2 border-dashed px-6 py-9 text-center transition-colors',
          over ? 'border-fjord bg-glacier' : shownError ? 'border-rose bg-rose-bg' : 'border-line bg-mist hover:border-ink-3',
        )}
      >
        <Upload className="size-6 text-fjord" aria-hidden />
        <span className="font-medium">Drop a spreadsheet here, or choose a file</span>
        <span className="text-[12.5px] text-ink-3">
          {accept.join(' or ')}, up to {size(maxBytes)} and 2,000 goods
        </span>
      </button>
      <input ref={input} type="file" accept={accept.join(',')} className="sr-only" tabIndex={-1} onChange={(e) => take(e.target.files?.[0] ?? undefined)} />
      {shownError && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-rose">
          {shownError}
        </p>
      )}
    </div>
  );
}
