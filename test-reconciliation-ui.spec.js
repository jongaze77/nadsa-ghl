const { test, expect } = require('@playwright/test');

test('Debug reconciliation page - check for matched payments in UI', async ({ page }) => {
  console.log('🔍 Starting UI debug test...');
  
  // Navigate to login first
  await page.goto('http://localhost:3000/login');
  
  // Fill in admin credentials (you'll need to provide these)
  console.log('📝 Logging in as admin...');
  await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin');
  await page.click('button[type="submit"]');
  
  // Wait for redirect to complete
  await page.waitForLoadState('networkidle');
  
  // Navigate to reconciliation page
  console.log('🏃 Navigating to reconciliation page...');
  await page.goto('http://localhost:3000/admin/reconciliation');
  
  // Wait for payments tab and click it
  console.log('💳 Switching to payments tab...');
  await page.click('button:has-text("Payment Processing")');
  
  // Wait for payment list to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Give it extra time
  
  // Filter by £30 amount to match what user was seeing
  console.log('💰 Setting amount filter to £30...');
  const amountSelect = page.locator('select[id="amount-filter"]');
  await amountSelect.selectOption('30');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  // Capture all payment cards
  const paymentCards = await page.locator('.grid > div').all();
  console.log(`📊 Found ${paymentCards.length} payment cards in UI`);
  
  // Check each payment card for status
  const paymentDetails = [];
  
  for (let i = 0; i < Math.min(paymentCards.length, 10); i++) {
    const card = paymentCards[i];
    
    // Get the status badge
    const statusBadge = card.locator('span:has-text("pending"), span:has-text("Pending"), span:has-text("matched"), span:has-text("Matched"), span:has-text("confirmed"), span:has-text("Confirmed"), span:has-text("ignored"), span:has-text("Ignored")').first();
    
    // Get payment amount and description for identification
    const amountText = await card.locator('text=/£\\d+\\.\\d+/').first().textContent().catch(() => 'N/A');
    const descriptionText = await card.locator('text=/Description:/').locator('~ span').first().textContent().catch(() => 'N/A');
    
    const statusText = await statusBadge.textContent().catch(() => 'No status found');
    const statusClass = await statusBadge.getAttribute('class').catch(() => 'No class');
    
    paymentDetails.push({
      index: i,
      amount: amountText,
      description: descriptionText?.substring(0, 50) || 'N/A',
      statusText: statusText.toLowerCase(),
      statusClass: statusClass
    });
    
    console.log(`Payment ${i + 1}: Amount=${amountText}, Status="${statusText}", Class="${statusClass}"`);
  }
  
  // Check for any payments showing as matched
  const matchedPayments = paymentDetails.filter(p => 
    p.statusText.includes('matched') || p.statusClass.includes('green')
  );
  
  console.log(`\\n🎯 RESULTS:`);
  console.log(`Total payments in UI: ${paymentCards.length}`);
  console.log(`Payments showing as "matched": ${matchedPayments.length}`);
  
  if (matchedPayments.length > 0) {
    console.log(`\\n⚠️  MATCHED PAYMENTS FOUND IN UI:`);
    matchedPayments.forEach(p => {
      console.log(`  Payment ${p.index + 1}: ${p.amount} - "${p.statusText}" - ${p.description}`);
      console.log(`    CSS Class: ${p.statusClass}`);
    });
  } else {
    console.log(`\\n✅ No matched payments visible in UI (correct)`);
  }
  
  // Take a screenshot for visual evidence
  await page.screenshot({ 
    path: 'reconciliation-page-debug.png', 
    fullPage: true 
  });
  console.log(`\\n📸 Screenshot saved as reconciliation-page-debug.png`);
  
  // Also capture the "Show all payments" state
  console.log(`\\n🔄 Testing "Show all payments" checkbox...`);
  const showAllCheckbox = page.locator('input[type="checkbox"]:near(:text("Show all payments"))');
  await showAllCheckbox.check();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  const allPaymentCards = await page.locator('.grid > div').all();
  console.log(`📊 After checking "Show all": ${allPaymentCards.length} payment cards`);
  
  await page.screenshot({ 
    path: 'reconciliation-page-show-all.png', 
    fullPage: true 
  });
  console.log(`📸 "Show all" screenshot saved as reconciliation-page-show-all.png`);
});