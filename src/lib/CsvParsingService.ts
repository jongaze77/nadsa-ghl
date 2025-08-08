import { createHash } from 'crypto';
import { prisma } from './prisma';

export interface ParsedPaymentData {
  transactionFingerprint: string;
  paymentDate: Date;
  amount: number;
  source: 'BANK_CSV' | 'STRIPE_REPORT';
  transactionRef: string;
  description?: string;
  hashedAccountIdentifier?: string;
}

export interface CsvParsingResult {
  success: boolean;
  data?: ParsedPaymentData[];
  errors?: string[];
  processed: number;
  skipped: number;
}

export interface LloydsBankCsvRow {
  'Transaction Date': string;
  'Transaction Type': string;
  'Sort Code': string;
  'Account Number': string;
  'Transaction Description': string;
  'Debit Amount': string;
  'Credit Amount': string;
  'Balance': string; // Will be immediately discarded per NFR1
}

export interface StripeCsvRow {
  id: string;
  Amount: string;
  'Created (UTC)': string;
  Description: string;
  [key: string]: string;
}

export class CsvParsingService {
  private logger: Console;

  constructor() {
    this.logger = console;
  }

  async parseLloydsBankCsv(csvContent: string): Promise<CsvParsingResult> {
    try {
      this.logger.log('Starting Lloyds Bank CSV parsing');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return {
          success: false,
          errors: ['CSV file is empty'],
          processed: 0,
          skipped: 0
        };
      }

      const headers = this.parseCsvLine(lines[0]);
      const requiredHeaders = ['Transaction Date', 'Account Number', 'Transaction Description', 'Credit Amount'];
      
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        return {
          success: false,
          errors: [`Missing required headers: ${missingHeaders.join(', ')}`],
          processed: 0,
          skipped: 0
        };
      }

      const data: ParsedPaymentData[] = [];
      const errors: string[] = [];
      let processed = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCsvLine(lines[i]);
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            skipped++;
            continue;
          }

          const row: LloydsBankCsvRow = headers.reduce((obj, header, index) => {
            obj[header as keyof LloydsBankCsvRow] = values[index];
            return obj;
          }, {} as LloydsBankCsvRow);

          // NFR1: Balance field is discarded immediately - never stored
          delete (row as any).Balance;

          const creditAmount = parseFloat(row['Credit Amount'] || '0');
          if (creditAmount <= 0) {
            skipped++;
            continue; // Skip non-credit transactions
          }

          // NFR2: Hash account number immediately and discard original
          const hashedAccountIdentifier = this.hashAccountNumber(
            row['Sort Code'] + row['Account Number']
          );
          
          // Generate transaction fingerprint
          const transactionFingerprint = this.generateBankTransactionFingerprint(
            row['Transaction Date'],
            creditAmount.toString(),
            row['Transaction Description']
          );

          // Check for existing transaction
          const existingTransaction = await prisma.reconciliationLog.findUnique({
            where: { transactionFingerprint }
          });

          if (existingTransaction) {
            skipped++;
            continue;
          }

          const parsedData: ParsedPaymentData = {
            transactionFingerprint,
            paymentDate: this.parseDate(row['Transaction Date']),
            amount: creditAmount,
            source: 'BANK_CSV',
            transactionRef: row['Transaction Description'],
            description: row['Transaction Description'],
            hashedAccountIdentifier
          };

          data.push(parsedData);
          processed++;

        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skipped++;
        }
      }

      return {
        success: errors.length === 0,
        data,
        errors: errors.length > 0 ? errors : undefined,
        processed,
        skipped
      };

    } catch (error) {
      this.logger.error('Error parsing Lloyds Bank CSV:', error);
      return {
        success: false,
        errors: [`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        processed: 0,
        skipped: 0
      };
    }
  }

  async parseStripeCsv(csvContent: string): Promise<CsvParsingResult> {
    try {
      this.logger.log('Starting Stripe CSV parsing');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return {
          success: false,
          errors: ['CSV file is empty'],
          processed: 0,
          skipped: 0
        };
      }

      const headers = this.parseCsvLine(lines[0]);
      const requiredHeaders = ['id', 'Amount', 'Created (UTC)'];
      
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        return {
          success: false,
          errors: [`Missing required headers: ${missingHeaders.join(', ')}`],
          processed: 0,
          skipped: 0
        };
      }

      const data: ParsedPaymentData[] = [];
      const errors: string[] = [];
      let processed = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCsvLine(lines[i]);
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            skipped++;
            continue;
          }

          const row: StripeCsvRow = headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
          }, {} as StripeCsvRow);

          const amount = Math.abs(parseFloat(row.Amount) / 100); // Stripe amounts are in cents
          if (amount <= 0) {
            skipped++;
            continue;
          }

          // Use Stripe source_id as transaction fingerprint
          const transactionFingerprint = row.id;

          // Check for existing transaction
          const existingTransaction = await prisma.reconciliationLog.findUnique({
            where: { transactionFingerprint }
          });

          if (existingTransaction) {
            skipped++;
            continue;
          }

          const parsedData: ParsedPaymentData = {
            transactionFingerprint,
            paymentDate: new Date(row['Created (UTC)']),
            amount,
            source: 'STRIPE_REPORT',
            transactionRef: row.id,
            description: row.Description || `Stripe transaction ${row.id}`
          };

          data.push(parsedData);
          processed++;

        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          skipped++;
        }
      }

      return {
        success: errors.length === 0,
        data,
        errors: errors.length > 0 ? errors : undefined,
        processed,
        skipped
      };

    } catch (error) {
      this.logger.error('Error parsing Stripe CSV:', error);
      return {
        success: false,
        errors: [`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        processed: 0,
        skipped: 0
      };
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private hashAccountNumber(accountIdentifier: string): string {
    return createHash('sha256').update(accountIdentifier).digest('hex');
  }

  private generateBankTransactionFingerprint(date: string, amount: string, description: string): string {
    const combined = `${date}_${amount}_${description}`;
    return createHash('sha256').update(combined).digest('hex');
  }

  private parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateString}`);
    }
    return date;
  }

  async validateData(data: ParsedPaymentData[]): Promise<{ valid: ParsedPaymentData[], invalid: { data: ParsedPaymentData, errors: string[] }[] }> {
    const valid: ParsedPaymentData[] = [];
    const invalid: { data: ParsedPaymentData, errors: string[] }[] = [];

    for (const item of data) {
      const errors: string[] = [];

      if (!item.transactionFingerprint) {
        errors.push('Missing transaction fingerprint');
      }

      if (!item.paymentDate || isNaN(item.paymentDate.getTime())) {
        errors.push('Invalid payment date');
      }

      if (!item.amount || item.amount <= 0) {
        errors.push('Invalid payment amount');
      }

      if (!['BANK_CSV', 'STRIPE_REPORT'].includes(item.source)) {
        errors.push('Invalid payment source');
      }

      if (!item.transactionRef) {
        errors.push('Missing transaction reference');
      }

      if (errors.length === 0) {
        valid.push(item);
      } else {
        invalid.push({ data: item, errors });
      }
    }

    return { valid, invalid };
  }
}