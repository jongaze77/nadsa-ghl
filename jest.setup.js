import '@testing-library/jest-dom'

// Set up environment variables for tests
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Email service environment variables - defaults for test isolation
// Individual test suites can override these and call EmailService._refreshConfigForTesting()
process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false' // Default to false for most tests
process.env.SMTP_HOST = 'localhost'
process.env.SMTP_PORT = '587'
process.env.SMTP_SECURE = 'false'
process.env.EMAIL_FROM_ADDRESS = 'noreply@localhost'
process.env.EMAIL_FROM_NAME = 'Security System'
process.env.ADMIN_EMAIL_ADDRESSES = ''

// Mock Next.js Request and Response objects
global.Request = class MockRequest {
  constructor(input, init) {
    this.url = input
    this.method = init?.method || 'GET'
    this.headers = new Headers(init?.headers)
  }
}

global.Response = class MockResponse {
  constructor(body, init) {
    this.body = body
    this.status = init?.status || 200
    this.headers = new Headers(init?.headers)
  }
  
  static json(data, init) {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
  }
}

global.Headers = class MockHeaders {
  constructor(init) {
    this._headers = new Map()
    if (init) {
      for (const [key, value] of Object.entries(init)) {
        this._headers.set(key.toLowerCase(), value)
      }
    }
  }
  
  get(name) { return this._headers.get(name.toLowerCase()) }
  set(name, value) { this._headers.set(name.toLowerCase(), value) }
  has(name) { return this._headers.has(name.toLowerCase()) }
}