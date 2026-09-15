import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// LIVENESS PROBE (GET /health)
export function getLiveness(req: Request, res: Response) {
    return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
};

// READINESS PROBE (GET /ready)
export async function getReadiness(req: Request, res: Response) {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: 'Connected'
        });
    } catch (error) {
        return res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'Disconnected'
        });
    }
};