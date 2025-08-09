// Investigation script for matching issue
// PendingPayment ID: cme3gb0kd012tfg6ldypoqrs6
// Contact ID: j4NawvFitENQfJTN5KfZ

import { prisma } from '@/lib/prisma';

interface InvestigationResult {
  pendingPayment: any;
  contact: any;
  matchingAnalysis: {
    nameFields: {
      paymentDescription?: string;
      customerName?: string;
      contactFirstName?: string;
      contactLastName?: string;
      contactFullName?: string;
    };
    emailFields: {
      customerEmail?: string;
      contactEmail?: string;
    };
    phoneFields: {
      contactPhone?: string;
    };
    amountFields: {
      paymentAmount: number;
      membershipType?: string;
    };
    dateFields: {
      paymentDate: string;
      contactCreatedAt: string;
      contactUpdatedAt: string;
    };
  };
  potentialMatchingIssues: string[];
}

async function main() {
  try {
    console.log('🔍 Investigating matching issue...\n');
    
    const pendingPaymentId = 'cme3gb0kd012tfg6ldypoqrs6';
    const contactId = 'j4NawvFitENQfJTN5KfZ';
    
    // Fetch PendingPayment record
    console.log(`📄 Fetching PendingPayment: ${pendingPaymentId}`);
    const pendingPayment = await prisma.pendingPayment.findUnique({
      where: { id: pendingPaymentId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    if (!pendingPayment) {
      console.error(`❌ PendingPayment with ID ${pendingPaymentId} not found`);
      return;
    }
    
    console.log(`✅ Found PendingPayment:`);
    console.log(`   - Transaction Fingerprint: ${pendingPayment.transactionFingerprint}`);
    console.log(`   - Amount: £${pendingPayment.amount}`);
    console.log(`   - Payment Date: ${pendingPayment.paymentDate}`);
    console.log(`   - Description: ${pendingPayment.description || 'N/A'}`);
    console.log(`   - Source: ${pendingPayment.source}`);
    console.log(`   - Status: ${pendingPayment.status}`);
    console.log(`   - Metadata: ${JSON.stringify(pendingPayment.metadata, null, 2)}`);
    console.log('');
    
    // Fetch Contact record
    console.log(`👤 Fetching Contact: ${contactId}`);
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });
    
    if (!contact) {
      console.error(`❌ Contact with ID ${contactId} not found`);
      return;
    }
    
    console.log(`✅ Found Contact:`);
    console.log(`   - Name: ${contact.name || 'N/A'}`);
    console.log(`   - First Name: ${contact.firstName || 'N/A'}`);
    console.log(`   - Last Name: ${contact.lastName || 'N/A'}`);
    console.log(`   - Email: ${contact.email || 'N/A'}`);
    console.log(`   - Phone: ${contact.phone || 'N/A'}`);
    console.log(`   - Membership Type: ${contact.membershipType || 'N/A'}`);
    console.log(`   - Created: ${contact.createdAt}`);
    console.log(`   - Updated: ${contact.updatedAt}`);
    console.log(`   - Custom Fields: ${JSON.stringify(contact.customFields, null, 2)}`);
    console.log('');
    
    // Extract metadata from pending payment for matching analysis
    const metadata = pendingPayment.metadata as any || {};
    const customerName = metadata.customer_name || metadata.customerName;
    const customerEmail = metadata.customer_email || metadata.customerEmail;
    
    // Create matching analysis
    const matchingAnalysis = {
      nameFields: {
        paymentDescription: pendingPayment.description || undefined,
        customerName: customerName || undefined,
        contactFirstName: contact.firstName || undefined,
        contactLastName: contact.lastName || undefined,
        contactFullName: contact.name || undefined,
      },
      emailFields: {
        customerEmail: customerEmail || undefined,
        contactEmail: contact.email || undefined,
      },
      phoneFields: {
        contactPhone: contact.phone || undefined,
      },
      amountFields: {
        paymentAmount: Number(pendingPayment.amount),
        membershipType: contact.membershipType || undefined,
      },
      dateFields: {
        paymentDate: pendingPayment.paymentDate.toISOString(),
        contactCreatedAt: contact.createdAt.toISOString(),
        contactUpdatedAt: contact.updatedAt.toISOString(),
      }
    };
    
    // Analyze potential matching issues
    const potentialIssues: string[] = [];
    
    // Check name matching potential
    if (!customerName && !pendingPayment.description) {
      potentialIssues.push('No name information in payment (no customer_name or description)');
    }
    
    if (!contact.firstName && !contact.lastName && !contact.name) {
      potentialIssues.push('Contact has no name fields populated');
    }
    
    // Check email matching potential
    if (!customerEmail) {
      potentialIssues.push('No customer email in payment metadata');
    }
    
    if (!contact.email) {
      potentialIssues.push('Contact has no email address');
    }
    
    if (customerEmail && contact.email && customerEmail !== contact.email) {
      potentialIssues.push(`Email mismatch: payment email "${customerEmail}" vs contact email "${contact.email}"`);
    }
    
    // Check if contact was recently reconciled (which would exclude it from matching)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentReconciliation = await prisma.reconciliationLog.findFirst({
      where: {
        contactId: contactId,
        reconciledAt: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        reconciledAt: 'desc'
      }
    });
    
    if (recentReconciliation) {
      potentialIssues.push(`Contact was recently reconciled on ${recentReconciliation.reconciledAt.toISOString()}, excluding it from matching`);
    }
    
    // Check membership type vs payment amount
    const membershipFees = {
      'Single': { min: 20, max: 20 },
      'Double': { min: 30, max: 30 },
      'Associate': { min: 10, max: 10 },
      'Newsletter Only': { min: 0, max: 0 },
      'Full': { min: 20, max: 30 }  // Full membership can be either Single (£20) or Double (£30)
    };
    
    if (contact.membershipType && membershipFees[contact.membershipType as keyof typeof membershipFees]) {
      const feeRange = membershipFees[contact.membershipType as keyof typeof membershipFees];
      const paymentAmount = Number(pendingPayment.amount);
      if (paymentAmount < feeRange.min || paymentAmount > feeRange.max) {
        potentialIssues.push(`Payment amount £${paymentAmount} is outside expected range £${feeRange.min}-${feeRange.max} for membership type "${contact.membershipType}"`);
      }
    }
    
    // Create final result
    const result: InvestigationResult = {
      pendingPayment: {
        id: pendingPayment.id,
        transactionFingerprint: pendingPayment.transactionFingerprint,
        amount: Number(pendingPayment.amount),
        paymentDate: pendingPayment.paymentDate.toISOString(),
        description: pendingPayment.description,
        source: pendingPayment.source,
        status: pendingPayment.status,
        metadata: pendingPayment.metadata
      },
      contact: {
        id: contact.id,
        name: contact.name,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        membershipType: contact.membershipType,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
        customFields: contact.customFields
      },
      matchingAnalysis,
      potentialMatchingIssues: potentialIssues
    };
    
    console.log('🔍 MATCHING ANALYSIS');
    console.log('===================');
    console.log('Name Fields:');
    Object.entries(matchingAnalysis.nameFields).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value || 'N/A'}`);
    });
    console.log('');
    
    console.log('Email Fields:');
    Object.entries(matchingAnalysis.emailFields).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value || 'N/A'}`);
    });
    console.log('');
    
    console.log('Amount & Membership:');
    console.log(`   - Payment Amount: £${matchingAnalysis.amountFields.paymentAmount}`);
    console.log(`   - Membership Type: ${matchingAnalysis.amountFields.membershipType || 'N/A'}`);
    console.log('');
    
    console.log('⚠️  POTENTIAL MATCHING ISSUES');
    console.log('==============================');
    if (potentialIssues.length === 0) {
      console.log('✅ No obvious matching issues found');
    } else {
      potentialIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    console.log('');
    
    // Check if there was a recent reconciliation for this transaction
    console.log('🔍 RECONCILIATION STATUS');
    console.log('========================');
    const existingReconciliation = await prisma.reconciliationLog.findUnique({
      where: { transactionFingerprint: pendingPayment.transactionFingerprint }
    });
    
    if (existingReconciliation) {
      console.log(`⚠️ This transaction has already been reconciled:`);
      console.log(`   - Reconciliation ID: ${existingReconciliation.id}`);
      console.log(`   - Contact ID: ${existingReconciliation.contactId}`);
      console.log(`   - Reconciled At: ${existingReconciliation.reconciledAt}`);
    } else {
      console.log(`✅ Transaction has not been reconciled yet`);
    }
    console.log('');
    
    // Save detailed analysis to file
    console.log('💾 Saving detailed analysis to investigation-result.json');
    const fs = await import('fs');
    await fs.promises.writeFile(
      './investigation-result.json', 
      JSON.stringify(result, null, 2), 
      'utf8'
    );
    console.log('✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();