import * as XLSX from 'xlsx';

export async function parseExcelFile(buffer: Buffer): Promise<any[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // แปลงเป็น json
    const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false});
    //trim ช่องว่างออก
    return rawData.map((row) => {
        const cleanedRow = {};
        Object.keys(row as Record<string, any>).forEach((key) => {
            const value = (row as Record<string, any>)[key];
            cleanedRow[key] = typeof value === 'string' ? value.trim() : value;
        });
        return cleanedRow;
    });
}