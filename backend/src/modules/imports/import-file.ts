import { Workbook } from 'exceljs';
import { gridToSheet, ImportFileError, normaliseCell, parseCsv, type CellValue, type ParsedSheet } from './import-parse';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Sheets padded with formatting can report huge row counts; refuse those before reading every cell. */
export const MAX_SHEET_ROWS = 100_000;

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // every .xlsx is a zip archive

/** Checks the bytes, not just the extension: a renamed executable or binary must not reach the parsers. */
export function checkFileContent(ext: string | undefined, buffer: Buffer) {
  if (buffer.length === 0) throw new ImportFileError('The file is empty.');
  if (ext === 'xlsx' && !ZIP_SIGNATURE.every((b, i) => buffer[i] === b)) {
    throw new ImportFileError('This file is not a real Excel workbook, even though its name ends in .xlsx. Open it in Excel and save it as .xlsx again.');
  }
  if (ext === 'csv') {
    if (buffer.includes(0)) throw new ImportFileError('This CSV file contains binary data. Export it from Excel as "CSV UTF-8".');
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new ImportFileError('This CSV file is not UTF-8 text. In Excel, save it as "CSV UTF-8 (Comma delimited)".');
    }
  }
}

/** Reads an uploaded .xlsx or .csv into mapped rows. Only the first worksheet of a workbook is read. */
export async function readImportFile(fileName: string, buffer: Buffer): Promise<ParsedSheet & { sheetName: string | null }> {
  const ext = fileName.toLowerCase().split('.').pop();
  if (buffer.length > MAX_FILE_BYTES) throw new ImportFileError('The file is larger than 5 MB. Split it into smaller files.');
  checkFileContent(ext, buffer);

  if (ext === 'csv') {
    return { ...gridToSheet(parseCsv(buffer.toString('utf8'))), sheetName: null };
  }
  if (ext === 'xls') throw new ImportFileError('Old .xls files are not supported. In Excel, use File > Save As and choose "Excel Workbook (.xlsx)".');
  if (ext !== 'xlsx') throw new ImportFileError('Upload an Excel workbook (.xlsx) or a CSV file.');

  const wb = new Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch {
    throw new ImportFileError('This file could not be opened as an Excel workbook. Check that it is a valid .xlsx file.');
  }
  const ws = wb.worksheets.find((w) => w.state !== 'hidden' && w.rowCount > 0) ?? wb.worksheets[0];
  if (!ws) throw new ImportFileError('The workbook has no worksheets.');
  if (ws.rowCount > MAX_SHEET_ROWS) {
    throw new ImportFileError(`The first sheet reports ${ws.rowCount.toLocaleString('en')} rows, which usually means formatting was applied to whole columns. Copy just the goods into a new workbook and upload that.`);
  }

  const grid: CellValue[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: CellValue[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = normaliseCell(cell.value);
    });
    grid[rowNumber - 1] = Array.from(cells, (c) => c ?? null);
  });
  for (let i = 0; i < grid.length; i++) grid[i] ??= [];
  return { ...gridToSheet(grid), sheetName: ws.name };
}
