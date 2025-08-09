// Playwright test for Save Changes button functionality
const { test, expect } = require('@playwright/test');

test('Save Changes button works in contact edit modal', async ({ page }) => {
  // Navigate to the contacts page
  await page.goto('http://localhost:3000/login');
  
  // Login (assuming admin credentials from env)
  await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin');
  await page.click('button[type="submit"]');
  
  // Wait for redirect to contacts page
  await page.waitForURL('**/all-contacts');
  
  // Check if we have contacts or need to create one
  const hasContacts = await page.locator('tbody tr').count() > 0;
  
  if (!hasContacts) {
    console.log('No contacts found, creating a test contact...');
    
    // Click "Add New Contact" button
    await page.click('a:has-text("Add New Contact")');
    await page.waitForURL('**/contacts/new');
    
    // Fill out the new contact form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Contact');
    await page.fill('input[name="email"]', 'test.contact@example.com');
    
    // Submit the form
    await page.click('button:has-text("Create Contact")');
    
    // Wait for redirect back to contacts
    await page.waitForURL('**/all-contacts');
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    console.log('Test contact created!');
  }
  
  // Click on first contact to open edit modal
  const firstContact = page.locator('tbody tr').first();
  console.log('Clicking first contact...');
  await firstContact.click();
  
  // Wait for modal to open with more debugging
  console.log('Waiting for modal to open...');
  try {
    await expect(page.locator('h2:has-text("Edit Contact")')).toBeVisible({ timeout: 10000 });
    console.log('Modal opened successfully!');
  } catch (error) {
    console.log('Modal failed to open. Current page content:');
    console.log(await page.content());
    throw error;
  }
  
  // Fill out required fields
  await page.fill('input[id="firstName"]', 'Test');
  await page.fill('input[id="lastName"]', 'User');
  await page.fill('input[id="email"]', 'test@example.com');
  
  // Set up console log monitoring
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.text().includes('🔵') || msg.text().includes('✅') || msg.text().includes('❌')) {
      consoleLogs.push(msg.text());
    }
  });
  
  // Click Save Changes button
  await page.click('button[type="submit"]:has-text("Save Changes")');
  
  // Wait a bit for the save process
  await page.waitForTimeout(2000);
  
  // Verify console logs show the save process
  expect(consoleLogs.some(log => log.includes('Form submission triggered'))).toBeTruthy();
  expect(consoleLogs.some(log => log.includes('[CLIENT] handleSave called'))).toBeTruthy();
  
  // Verify modal closes (save was successful)
  await expect(page.locator('text=Edit Contact')).not.toBeVisible();
  
  console.log('Console logs captured:');
  consoleLogs.forEach(log => console.log('  ', log));
});