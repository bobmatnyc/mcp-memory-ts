import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('MCP Memory Web Application Deployment Verification', () => {
  test('Homepage loads successfully', async ({ page }) => {
    const startTime = Date.now();

    // Navigate to homepage
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // Verify HTTP 200 response
    expect(response?.status()).toBe(200);

    // Verify page title
    await expect(page).toHaveTitle(/MCP Memory/);

    // Take screenshot
    await page.screenshot({ path: '/Users/masa/Projects/managed/mcp-memory-ts/docs/assets/homepage-screenshot.png', fullPage: true });

    console.log('Screenshot saved to: homepage-screenshot.png');
  });

  test('Verify page content and Clerk authentication UI', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Check for main heading
    const heading = page.locator('h3.font-bold');
    await expect(heading).toContainText('MCP Memory');

    // Check for sign-in description
    const description = page.locator('text=Sign in to access your AI memory service');
    await expect(description).toBeVisible();

    // Check for Clerk Sign In button
    const signInButton = page.locator('button:has-text("Sign In")');
    await expect(signInButton).toBeVisible();

    // Verify Terms of Service text
    const termsText = page.locator('text=By signing in, you agree to our Terms of Service and Privacy Policy');
    await expect(termsText).toBeVisible();

    // Verify Clerk script loads
    const clerkScript = page.locator('script[data-clerk-js-script="true"]');
    await expect(clerkScript).toHaveAttribute('src', /clerk\.accounts\.dev/);
  });

  test('Check console for errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Listen to console events
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);

      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Listen to page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Log console activity
    console.log('\n=== Console Messages ===');
    consoleMessages.forEach(msg => console.log(msg));

    console.log('\n=== Console Errors ===');
    if (consoleErrors.length === 0) {
      console.log('No errors found ✓');
    } else {
      consoleErrors.forEach(err => console.log(`ERROR: ${err}`));
    }

    console.log('\n=== Console Warnings ===');
    if (consoleWarnings.length === 0) {
      console.log('No warnings found ✓');
    } else {
      consoleWarnings.forEach(warn => console.log(`WARN: ${warn}`));
    }

    // Allow some warnings but no critical errors
    // Note: Some Clerk warnings may be expected in dev mode
    expect(consoleErrors.filter(e => !e.includes('Clerk') && !e.includes('chunk-'))).toHaveLength(0);
  });

  test('Verify CSS and assets load correctly', async ({ page }) => {
    const failedResources: string[] = [];

    page.on('requestfailed', request => {
      failedResources.push(`${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    console.log('\n=== Resource Loading ===');
    if (failedResources.length === 0) {
      console.log('All resources loaded successfully ✓');
    } else {
      console.log('Failed resources:');
      failedResources.forEach(res => console.log(`FAILED: ${res}`));
    }

    // Verify no failed resources
    expect(failedResources).toHaveLength(0);

    // Check that styles are applied
    const body = page.locator('body');
    const bodyClass = await body.getAttribute('class');
    expect(bodyClass).toBeTruthy();

    // Verify gradient background is rendered
    const gradientDiv = page.locator('.bg-gradient-to-br.from-blue-50.to-indigo-100');
    await expect(gradientDiv).toBeVisible();
  });

  test('Test API endpoint authentication', async ({ request }) => {
    console.log('\n=== API Endpoint Testing ===');

    // Test memories endpoint (should require authentication)
    const memoriesResponse = await request.get(`${BASE_URL}/api/memories`);
    console.log(`GET /api/memories: ${memoriesResponse.status()}`);

    const authStatus = memoriesResponse.headers()['x-clerk-auth-status'];
    console.log(`Clerk Auth Status: ${authStatus}`);

    // Should be either 401 or 404 with signed-out status
    expect([401, 404]).toContain(memoriesResponse.status());
    expect(authStatus).toBe('signed-out');

    // Test entities endpoint (should require authentication)
    const entitiesResponse = await request.get(`${BASE_URL}/api/entities`);
    console.log(`GET /api/entities: ${entitiesResponse.status()}`);

    expect([401, 404]).toContain(entitiesResponse.status());
  });

  test('Performance metrics', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        domInteractive: perf.domInteractive - perf.fetchStart,
        totalLoadTime: perf.loadEventEnd - perf.fetchStart,
        transferSize: perf.transferSize,
      };
    });

    console.log('\n=== Performance Metrics ===');
    console.log(`DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`Load Complete: ${performanceMetrics.loadComplete.toFixed(2)}ms`);
    console.log(`DOM Interactive: ${performanceMetrics.domInteractive.toFixed(2)}ms`);
    console.log(`Total Load Time: ${performanceMetrics.totalLoadTime.toFixed(2)}ms`);
    console.log(`Transfer Size: ${(performanceMetrics.transferSize / 1024).toFixed(2)}KB`);

    // Performance thresholds (reasonable for Next.js app)
    expect(performanceMetrics.totalLoadTime).toBeLessThan(5000); // Under 5 seconds
    expect(performanceMetrics.domInteractive).toBeLessThan(3000); // Under 3 seconds
  });

  test('Verify responsive design', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/Users/masa/Projects/managed/mcp-memory-ts/docs/assets/desktop-screenshot.png' });

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: '/Users/masa/Projects/managed/mcp-memory-ts/docs/assets/tablet-screenshot.png' });

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: '/Users/masa/Projects/managed/mcp-memory-ts/docs/assets/mobile-screenshot.png' });

    // Verify card is still visible on mobile
    const card = page.locator('.rounded-lg.border.bg-card');
    await expect(card).toBeVisible();

    console.log('\n=== Responsive Screenshots ===');
    console.log('Desktop: desktop-screenshot.png');
    console.log('Tablet: tablet-screenshot.png');
    console.log('Mobile: mobile-screenshot.png');
  });
});
