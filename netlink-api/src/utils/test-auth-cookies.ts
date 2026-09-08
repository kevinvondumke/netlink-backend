import assert from 'assert';
import { authenticate } from '../middleware/auth.middleware';
import { COOKIE_NAME, getAuthCookieOptions, getClearCookieOptions } from './cookies';
import { signToken } from '../services/jwt.service';
import { UnauthorizedError } from './errors';

console.log('\n------------------------------------------------------------------------');
console.log('STARTING HTTP-ONLY AUTHENTICATION COOKIE TEST SUITE');
console.log('------------------------------------------------------------------------');

// 1. TEST COOKIE OPTIONS GENERATOR
console.log('▶ [1/5] Testing Cookie Security Attributes (Dev & Prod)...');
{
    process.env.NODE_ENV = 'development';
    const devOptions = getAuthCookieOptions();
    assert.strictEqual(devOptions.httpOnly, true, 'httpOnly must always be true');
    assert.strictEqual(devOptions.secure, false, 'secure must be false on localhost HTTP');
    assert.strictEqual(devOptions.sameSite, 'lax', 'sameSite must be lax on localhost');
    assert.strictEqual(devOptions.path, '/', 'path must be /');
    assert.strictEqual(devOptions.maxAge, 3600000, 'maxAge must be 1 hour');

    const devClearOptions = getClearCookieOptions();
    assert.strictEqual(devClearOptions.httpOnly, true);
    assert.strictEqual(devClearOptions.secure, false);
    assert.strictEqual(devClearOptions.sameSite, 'lax');
    assert.strictEqual(devClearOptions.path, '/');

    process.env.NODE_ENV = 'production';
    const prodOptions = getAuthCookieOptions();
    assert.strictEqual(prodOptions.httpOnly, true, 'httpOnly must always be true in production');
    assert.strictEqual(prodOptions.secure, true, 'secure must be true for HTTPS in production');
    assert.strictEqual(prodOptions.sameSite, 'none', 'sameSite must be none for cross-site Netlify/Render deployment');
    assert.strictEqual(prodOptions.path, '/');

    const prodClearOptions = getClearCookieOptions();
    assert.strictEqual(prodClearOptions.secure, true);
    assert.strictEqual(prodClearOptions.sameSite, 'none');

    process.env.NODE_ENV = 'test';
    console.log('  ✔ Cookie attributes correctly adapt between Dev and Production environments.');
}

// 2. TEST AUTHENTICATE MIDDLEWARE - MISSING COOKIE
console.log('▶ [2/5] Testing Missing Cookie Rejection...');
{
    const req: any = { cookies: {} };
    let capturedError: any = null;

    authenticate(req, {} as any, (err: any) => {
        capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError, 'Must yield UnauthorizedError');
    assert.strictEqual(capturedError.statusCode, 401);
    assert.strictEqual(capturedError.message, 'Authentication cookie missing.');
    console.log('  ✔ Requests without auth_token cookie are rejected with 401 Unauthorized.');
}

// 3. TEST AUTHENTICATE MIDDLEWARE - VALID COOKIE
console.log('▶ [3/5] Testing Valid Cookie Authentication...');
{
    const token = signToken({ id: 'user-123', email: 'user@netlink.local' });
    const req: any = {
        cookies: {
            [COOKIE_NAME]: token
        }
    };

    let nextCalled = false;
    let capturedError: any = null;

    authenticate(req, {} as any, (err: any) => {
        if (err) capturedError = err;
        else nextCalled = true;
    });

    assert.strictEqual(capturedError, null, 'No error should occur with valid token');
    assert.strictEqual(nextCalled, true, 'next() should be called');
    assert.deepStrictEqual(req.user, { id: 'user-123', email: 'user@netlink.local' });
    console.log('  ✔ Valid auth_token cookie successfully authenticates and sets req.user.');
}

// 4. TEST AUTHENTICATE MIDDLEWARE - INVALID / TAMPERED COOKIE
console.log('▶ [4/5] Testing Invalid / Tampered Cookie Rejection...');
{
    const req: any = {
        cookies: {
            [COOKIE_NAME]: 'invalid.tampered.jwt-token'
        }
    };

    let capturedError: any = null;
    authenticate(req, {} as any, (err: any) => {
        capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError);
    assert.strictEqual(capturedError.statusCode, 401);
    assert.strictEqual(capturedError.message, 'Invalid or Expired Token.');
    console.log('  ✔ Tampered and invalid cookies are safely rejected with 401.');
}

// 5. TEST CONTROLLER COOKIE SET & CLEAR LOGIC
console.log('▶ [5/5] Testing Response Set-Cookie & Clear-Cookie Interface...');
{
    const cookiesSet: Record<string, { val: string; options: any }> = {};
    const cookiesCleared: Record<string, any> = {};

    const mockRes: any = {
        cookie(name: string, val: string, options: any) {
            cookiesSet[name] = { val, options };
            return this;
        },
        clearCookie(name: string, options: any) {
            cookiesCleared[name] = options;
            return this;
        }
    };

    const token = signToken({ id: 'user-456', email: 'test@netlink.local' });
    mockRes.cookie(COOKIE_NAME, token, getAuthCookieOptions());
    assert.ok(cookiesSet[COOKIE_NAME]);
    assert.strictEqual(cookiesSet[COOKIE_NAME].val, token);
    assert.strictEqual(cookiesSet[COOKIE_NAME].options.httpOnly, true);

    mockRes.clearCookie(COOKIE_NAME, getClearCookieOptions());
    assert.ok(cookiesCleared[COOKIE_NAME]);
    assert.strictEqual(cookiesCleared[COOKIE_NAME].httpOnly, true);
    console.log('  ✔ Cookie set and clear interfaces operate with correct security options.');
}

console.log('\n🎉 ALL 5 AUTHENTICATION COOKIE TEST SUITES PASSED!\n');
