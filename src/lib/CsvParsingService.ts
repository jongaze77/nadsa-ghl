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
  // New customer fields from Stripe CSV
  customer_name?: string;
  customer_email?: string;
  card_address_line1?: string;
  card_address_postal_code?: string;
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

interface StripeFieldMapping {
  id: string[];
  amount: string[];
  created: string[];
  description: string[];
  customer_name: string[];
  customer_email: string[];
  card_address_line1: string[];
  card_address_postal_code: string[];
}

export class CsvParsingService {
  private logger: Console;
  private stripeFieldMapping: StripeFieldMapping;

  constructor() {
    this.logger = console;
    
    // Define possible field names for Stripe CSV mapping
    this.stripeFieldMapping = {
      id: ['id', 'source_id', 'transaction_id', 'charge_id'],
      amount: ['Amount', 'amount', 'gross', 'Gross', 'Customer_facing_amount', 'customer_facing_amount', 'total', 'Total'],
      created: ['Created (UTC)', 'created_utc', 'created', 'date', 'Date', 'timestamp'],
      description: ['Description', 'description', 'memo', 'note', 'details'],
      customer_name: ['customer_name', 'Customer_name', 'name', 'Name', 'customer name', 'Customer Name'],
      customer_email: ['customer_email', 'Customer_email', 'email', 'Email', 'customer email', 'Customer Email'],
      card_address_line1: ['card_address_line1', 'Card_address_line1', 'address_line1', 'Address_line1', 'billing_address_line1', 'Billing_address_line1'],
      card_address_postal_code: ['card_address_postal_code', 'Card_address_postal_code', 'postal_code', 'Postal_code', 'zip_code', 'Zip_code']
    };
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
      
      // Map actual headers to expected fields
      const headerMapping = this.mapStripeHeaders(headers);
      
      if (!headerMapping.success) {
        return {
          success: false,
          errors: headerMapping.errors || ['Failed to map required Stripe headers'],
          processed: 0,
          skipped: 0
        };
      }

      const data: ParsedPaymentData[] = [];
      const errors: string[] = [];
      let processed = 0;
      let skipped = 0;
      
      const { 
        idIndex, 
        amountIndex, 
        createdIndex, 
        descriptionIndex,
        customerNameIndex,
        customerEmailIndex,
        cardAddressLine1Index,
        cardAddressPostalCodeIndex
      } = headerMapping.mapping!;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCsvLine(lines[i]);
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            skipped++;
            continue;
          }

          // Extract values using mapped indices
          const id = values[idIndex];
          const amountStr = values[amountIndex];
          const createdStr = values[createdIndex];
          const description = descriptionIndex !== -1 ? values[descriptionIndex] : '';
          
          // Extract customer fields
          const customer_name = customerNameIndex !== -1 ? values[customerNameIndex] : undefined;
          const customer_email = customerEmailIndex !== -1 ? values[customerEmailIndex] : undefined;
          const card_address_line1 = cardAddressLine1Index !== -1 ? values[cardAddressLine1Index] : undefined;
          const card_address_postal_code = cardAddressPostalCodeIndex !== -1 ? values[cardAddressPostalCodeIndex] : undefined;

          // FIX: Preserve pound values correctly - do NOT divide by 100
          // Stripe CSV contains pound values (e.g., £42) that should stay as 42.00, not become 0.42
          const amount = Math.abs(parseFloat(amountStr));
          if (amount <= 0) {
            skipped++;
            continue;
          }

          // Use Stripe transaction id as transaction fingerprint
          const transactionFingerprint = id;

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
            paymentDate: new Date(createdStr),
            amount,
            source: 'STRIPE_REPORT',
            transactionRef: id,
            description: description || `Stripe transaction ${id}`,
            customer_name: customer_name?.trim() || undefined,
            customer_email: customer_email?.trim() || undefined,
            card_address_line1: card_address_line1?.trim() || undefined,
            card_address_postal_code: card_address_postal_code?.trim() || undefined
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

  private mapStripeHeaders(headers: string[]): { success: boolean; errors?: string[]; mapping?: { idIndex: number; amountIndex: number; createdIndex: number; descriptionIndex: number; customerNameIndex: number; customerEmailIndex: number; cardAddressLine1Index: number; cardAddressPostalCodeIndex: number } } {
    const mapping = {
      idIndex: -1,
      amountIndex: -1,
      createdIndex: -1,
      descriptionIndex: -1,
      customerNameIndex: -1,
      customerEmailIndex: -1,
      cardAddressLine1Index: -1,
      cardAddressPostalCodeIndex: -1
    };
    
    const errors: string[] = [];
    
    // Find matching headers for each required field
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      
      // Check ID field
      if (mapping.idIndex === -1 && this.stripeFieldMapping.id.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.idIndex = i;
      }
      
      // Check Amount field
      if (mapping.amountIndex === -1 && this.stripeFieldMapping.amount.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.amountIndex = i;
      }
      
      // Check Created field
      if (mapping.createdIndex === -1 && this.stripeFieldMapping.created.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.createdIndex = i;
      }
      
      // Check Description field (optional)
      if (mapping.descriptionIndex === -1 && this.stripeFieldMapping.description.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.descriptionIndex = i;
      }
      
      // Check customer_name field (optional)
      if (mapping.customerNameIndex === -1 && this.stripeFieldMapping.customer_name.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.customerNameIndex = i;
      }
      
      // Check customer_email field (optional)
      if (mapping.customerEmailIndex === -1 && this.stripeFieldMapping.customer_email.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.customerEmailIndex = i;
      }
      
      // Check card_address_line1 field (optional)
      if (mapping.cardAddressLine1Index === -1 && this.stripeFieldMapping.card_address_line1.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.cardAddressLine1Index = i;
      }
      
      // Check card_address_postal_code field (optional)
      if (mapping.cardAddressPostalCodeIndex === -1 && this.stripeFieldMapping.card_address_postal_code.some(field => 
        header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()))) {
        mapping.cardAddressPostalCodeIndex = i;
      }
    }
    
    // Validate required fields were found
    if (mapping.idIndex === -1) {
      errors.push(`Required ID field not found. Looking for one of: ${this.stripeFieldMapping.id.join(', ')}`);
    }
    
    if (mapping.amountIndex === -1) {
      errors.push(`Required Amount field not found. Looking for one of: ${this.stripeFieldMapping.amount.join(', ')}`);
    }
    
    if (mapping.createdIndex === -1) {
      errors.push(`Required Created field not found. Looking for one of: ${this.stripeFieldMapping.created.join(', ')}`);
    }
    
    if (errors.length > 0) {
      this.logger.error('Stripe header mapping failed:', errors);
      this.logger.error('Available headers:', headers);
      return { success: false, errors };
    }
    
    const customerFieldsInfo = [
      mapping.customerNameIndex !== -1 ? `CustomerName=${headers[mapping.customerNameIndex]}` : '',
      mapping.customerEmailIndex !== -1 ? `CustomerEmail=${headers[mapping.customerEmailIndex]}` : '',
      mapping.cardAddressLine1Index !== -1 ? `AddressLine1=${headers[mapping.cardAddressLine1Index]}` : '',
      mapping.cardAddressPostalCodeIndex !== -1 ? `PostalCode=${headers[mapping.cardAddressPostalCodeIndex]}` : ''
    ].filter(Boolean).join(', ');
    
    this.logger.log(`Stripe header mapping successful: ID=${headers[mapping.idIndex]}, Amount=${headers[mapping.amountIndex]}, Created=${headers[mapping.createdIndex]}${mapping.descriptionIndex !== -1 ? `, Description=${headers[mapping.descriptionIndex]}` : ''}${customerFieldsInfo ? `, ${customerFieldsInfo}` : ''}`);
    
    return { success: true, mapping };
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
    // First try standard parsing
    let date = new Date(dateString);
    
    // If standard parsing fails or gives invalid date, try UK format detection
    if (isNaN(date.getTime())) {
      // Check for UK date format (dd/mm/yyyy or dd-mm-yyyy)
      const ukDateMatch = dateString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ukDateMatch) {
        const [, day, month, year] = ukDateMatch;
        this.logger.log(`Attempting UK date parsing: ${dateString} -> ${day}/${month}/${year}`);
        // Create date in US format for parsing (mm/dd/yyyy)
        const usFormatDate = `${month}/${day}/${year}`;
        date = new Date(usFormatDate);
        
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date format: ${dateString} (failed UK format parsing - converted to ${usFormatDate})`);
        }
        this.logger.log(`Successfully parsed UK date: ${dateString} -> ${date.toISOString()}`);
        return date;
      }
      
      throw new Error(`Invalid date format: ${dateString} (unrecognized format - expected dd/mm/yyyy, mm/dd/yyyy, or ISO format)`);
    }
    
    // For valid standard dates, check if this might be ambiguous UK format
    // If day > 12, it's definitely UK format, reparse correctly
    const standardDateMatch = dateString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (standardDateMatch) {
      const [, firstNum, secondNum] = standardDateMatch;
      const first = parseInt(firstNum, 10);
      
      // If first number > 12, this is definitely UK format (day/month/year)
      if (first > 12) {
        const usFormatDate = `${secondNum}/${firstNum}/${standardDateMatch[3]}`;
        const correctedDate = new Date(usFormatDate);
        if (!isNaN(correctedDate.getTime())) {
          return correctedDate;
        }
      }
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
      
      // Validate reasonable amount range for membership (£5-£500)
      if (item.amount < 5 || item.amount > 500) {
        errors.push(`Payment amount £${item.amount} is outside expected range (£5-£500)`);
      }

      if (!['BANK_CSV', 'STRIPE_REPORT'].includes(item.source)) {
        errors.push('Invalid payment source');
      }

      if (!item.transactionRef) {
        errors.push('Missing transaction reference');
      }
      
      // Validate customer email format if provided
      if (item.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.customer_email)) {
        errors.push('Invalid customer email format');
      }
      
      // Validate postal code format if provided (UK format)
      if (item.card_address_postal_code && !/^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i.test(item.card_address_postal_code)) {
        // Allow various formats but warn if not standard UK
        if (item.card_address_postal_code.length < 3 || item.card_address_postal_code.length > 10) {
          errors.push('Postal code format may be invalid');
        }
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