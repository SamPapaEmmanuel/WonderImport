import { checkFileContent } from './import-file';
import { ImportFileError } from './import-parse';

describe('checkFileContent', () => {
  it('accepts a zip-signed .xlsx and UTF-8 CSV', () => {
    expect(() => checkFileContent('xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2]))).not.toThrow();
    expect(() => checkFileContent('csv', Buffer.from('Item name*,Quantity*\nFan,1\n', 'utf8'))).not.toThrow();
  });

  it('rejects a renamed file posing as .xlsx', () => {
    expect(() => checkFileContent('xlsx', Buffer.from('MZ\x90\x00 not a workbook'))).toThrow(ImportFileError);
  });

  it('rejects binary or non-UTF-8 CSV', () => {
    expect(() => checkFileContent('csv', Buffer.from([0x61, 0x00, 0x62]))).toThrow('binary');
    expect(() => checkFileContent('csv', Buffer.from([0x61, 0xff, 0xfe, 0x62]))).toThrow('UTF-8');
  });

  it('rejects empty files', () => {
    expect(() => checkFileContent('csv', Buffer.alloc(0))).toThrow('empty');
  });
});
