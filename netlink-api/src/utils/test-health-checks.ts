import assert from 'assert';
import { getLiveness, getReadiness } from '../controllers/health.controller';
import { prisma } from '../config/prisma';

console.log('\n------------------------------------------------------------------------');
console.log('STARTING HEALTH & READINESS PROBES TEST SUITE');
console.log('------------------------------------------------------------------------');

function createMockRes() {
    const res: any = {
        statusCode: 200,
        body: null,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data: any) {
            this.body = data;
            return this;
        }
    };
    return res;
}

// 1. TEST LIVENESS PROBE (GET /health)
console.log('▶ [1/3] Testing GET /health (Liveness)...');
{
    const res = createMockRes();
    getLiveness({} as any, res);

    assert.strictEqual(res.statusCode, 200, 'Liveness must always return 200');
    assert.strictEqual(res.body.status, 'OK');
    assert.ok(typeof res.body.uptime === 'number', 'Uptime must be a number');
    assert.ok(typeof res.body.timestamp === 'string', 'Timestamp must be an ISO string');
    console.log('  ✔ Liveness endpoint returns 200 OK and uptime.');
}

// 2. TEST READINESS PROBE SUCCESS (GET /ready with healthy DB)
console.log('▶ [2/3] Testing GET /ready (Readiness - Database Connected)...');
(async () => {
    const originalQueryRaw = prisma.$queryRaw;
    try {
        // Mock successful DB query
        (prisma as any).$queryRaw = async () => [{ '?column?': 1 }];

        const res = createMockRes();
        await getReadiness({} as any, res);

        assert.strictEqual(res.statusCode, 200, 'Readiness must return 200 when DB is connected');
        assert.strictEqual(res.body.status, 'OK');
        assert.strictEqual(res.body.database, 'Connected');
        console.log('  ✔ Readiness returns 200 OK when database probe succeeds.');
    } finally {
        (prisma as any).$queryRaw = originalQueryRaw;
    }

    // 3. TEST READINESS PROBE FAILURE (GET /ready with DB connection error)
    console.log('▶ [3/3] Testing GET /ready (Readiness - Database Disconnected)...');
    try {
        // Mock DB connection error
        (prisma as any).$queryRaw = async () => {
            throw new Error('Connection refused at 127.0.0.1:5432');
        };

        const res = createMockRes();
        await getReadiness({} as any, res);

        assert.strictEqual(res.statusCode, 503, 'Readiness must return 503 Service Unavailable when DB is down');
        assert.strictEqual(res.body.status, 'error');
        assert.strictEqual(res.body.database, 'Disconnected');
        assert.strictEqual(res.body.error, undefined, 'Must not leak database error message');
        console.log('  ✔ Readiness returns 503 Service Unavailable when database fails.');
    } finally {
        (prisma as any).$queryRaw = originalQueryRaw;
    }

    console.log('\n🎉 ALL 3 HEALTH CHECK TESTS PASSED!\n');
})();
