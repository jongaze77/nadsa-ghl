// Script to find better matches for the AUST payment
import { prisma } from '@/lib/prisma';
import { MatchingService } from '@/lib/MatchingService';
import type { ParsedPaymentData } from '@/lib/CsvParsingService';

async function main() {
  try {
    console.log('🔍 Finding better matches for AUST payment...\n');
    
    // Recreate the payment data from the pending payment record
    const pendingPaymentId = 'cme3gb0kd012tfg6ldypoqrs6';
    const pendingPayment = await prisma.pendingPayment.findUnique({
      where: { id: pendingPaymentId }
    });
    
    if (!pendingPayment) {
      console.error(`❌ PendingPayment with ID ${pendingPaymentId} not found`);
      return;
    }
    
    const paymentData: ParsedPaymentData = {
      transactionFingerprint: pendingPayment.transactionFingerprint,
      amount: Number(pendingPayment.amount),
      paymentDate: pendingPayment.paymentDate,
      description: pendingPayment.description || '',
      transactionRef: pendingPayment.transactionRef,
      source: pendingPayment.source as "BANK_CSV" | "STRIPE_REPORT",
      hashedAccountIdentifier: pendingPayment.hashedAccountIdentifier || undefined,
    };
    
    console.log('Payment data to match:');
    console.log(`- Description: "${paymentData.description}"`);
    console.log(`- Amount: £${paymentData.amount}`);
    console.log(`- Date: ${paymentData.paymentDate}`);
    console.log('');
    
    // Search for contacts with AUST surname
    console.log('🔍 Searching for contacts with "AUST" surname...');
    const austContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { lastName: { contains: 'Aust', mode: 'insensitive' } },
          { name: { contains: 'Aust', mode: 'insensitive' } },
          { firstName: { contains: 'Aust', mode: 'insensitive' } }
        ]
      }
    });
    
    console.log(`Found ${austContacts.length} contacts with "AUST" in their name:`);
    austContacts.forEach((contact, index) => {
      console.log(`${index + 1}. ID: ${contact.id}`);
      console.log(`   - Name: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.name || 'N/A'})`);
      console.log(`   - Email: ${contact.email || 'N/A'}`);
      console.log(`   - Membership Type: ${contact.membershipType || 'N/A'}`);
      console.log(`   - Created: ${contact.createdAt.toISOString().split('T')[0]}`);
      console.log('');
    });
    
    // Search for contacts with suitable membership type for £30 payment
    console.log('🔍 Searching for contacts with membership types suitable for £30...');
    const suitableContacts = await prisma.contact.findMany({
      where: {
        membershipType: {
          in: ['Double', 'Single'] // £30 falls in Double (30-40) range
        }
      },
      take: 10,
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    console.log(`Found ${suitableContacts.length} contacts with suitable membership types:`);
    suitableContacts.forEach((contact, index) => {
      console.log(`${index + 1}. ID: ${contact.id}`);
      console.log(`   - Name: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.name || 'N/A'})`);
      console.log(`   - Email: ${contact.email || 'N/A'}`);
      console.log(`   - Membership Type: ${contact.membershipType || 'N/A'}`);
      console.log(`   - Created: ${contact.createdAt.toISOString().split('T')[0]}`);
      console.log('');
    });
    
    // Use MatchingService to find actual matches (this should exclude recently reconciled contacts)
    console.log('🤖 Running MatchingService to find best matches...');
    const matchingService = new MatchingService();
    const matchingResult = await matchingService.findMatches(paymentData);
    
    console.log(`MatchingService found ${matchingResult.suggestions.length} suggestions:`);
    console.log(`Processing time: ${matchingResult.processingTimeMs}ms`);
    console.log('');
    
    if (matchingResult.suggestions.length === 0) {
      console.log('❌ No matches found by MatchingService');
    } else {
      matchingResult.suggestions.forEach((suggestion, index) => {
        console.log(`${index + 1}. Contact ID: ${suggestion.contact.id} (Confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
        console.log(`   - Name: ${suggestion.contact.firstName || ''} ${suggestion.contact.lastName || ''} (${suggestion.contact.name || 'N/A'})`);
        console.log(`   - Email: ${suggestion.contact.email || 'N/A'}`);
        console.log(`   - Membership Type: ${suggestion.contact.membershipType || 'N/A'}`);
        
        if (suggestion.reasoning.nameMatch) {
          console.log(`   - Name Match: ${(suggestion.reasoning.nameMatch.score * 100).toFixed(1)}% - "${suggestion.reasoning.nameMatch.extractedName}" vs "${suggestion.reasoning.nameMatch.matchedAgainst}"`);
        }
        if (suggestion.reasoning.emailMatch) {
          console.log(`   - Email Match: ${(suggestion.reasoning.emailMatch.score * 100).toFixed(1)}%`);
        }
        if (suggestion.reasoning.amountMatch) {
          console.log(`   - Amount Match: ${(suggestion.reasoning.amountMatch.score * 100).toFixed(1)}% - £${suggestion.reasoning.amountMatch.actualAmount} vs ${suggestion.reasoning.amountMatch.expectedRange}`);
        }
        console.log('');
      });
    }
    
    // Check recent reconciliations to understand the exclusion
    console.log('📊 Recent reconciliations (last 7 days)...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentReconciliations = await prisma.reconciliationLog.findMany({
      where: {
        reconciledAt: {
          gte: sevenDaysAgo
        }
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        reconciledAt: 'desc'
      }
    });
    
    console.log(`Found ${recentReconciliations.length} recent reconciliations:`);
    recentReconciliations.forEach((recon, index) => {
      console.log(`${index + 1}. ${recon.reconciledAt.toISOString()}`);
      console.log(`   - Contact: ${recon.contact.firstName || ''} ${recon.contact.lastName || ''} (${recon.contactId})`);
      console.log(`   - Amount: £${recon.amount}`);
      console.log(`   - Transaction: ${recon.transactionFingerprint.substring(0, 16)}...`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error during search:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();