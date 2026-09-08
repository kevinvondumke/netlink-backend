import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error';
import { apiRateLimiter } from './middleware/rate-limit';
import { NotFoundError } from './utils/errors';

dotenv.config();

export const createApp = () => {
    const app = express();

    app.use(
        helmet({
            // HTTP STRICT TRANSPORT SECURITY (HSTS)
            strictTransportSecurity: {
                maxAge: 31536000, // 1 year in seconds
                includeSubDomains: true,
                preload: true
            },
            // CONTENT SECURITY POLICY (CSP)
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    "defaultSrc": ["'self'"],
                    "scriptSrc": ["'self'", "'https://trusted-cdn.com'"],
                    "styleSrc": ["'self'", "'unsafe-inline'"],                    
                    "upgrade-insecure-requests": [],
                    "block-all-mixed-content": []
                }
            },
            // X-FRAME-OPTIONS
            xFrameOptions: {
                action: "deny"
            }
        }),
        cors({
            origin: [
                "http://localhost:5173",
                "https://net1ink.netlify.app"
            ],
            credentials: true
        })
    );
    
    app.use(express.json());
    app.use(cookieParser());

    // EXPRESS TEST ROUTE
    app.get('/health', (req: Request, res: Response) => {
        res.json({
            status: 'OK',
            message: 'APP SERVER CONNECTION SUCCESS',
            timestamp: new Date().toISOString()
        });
    });

    // REGISTER ROUTES
    app.use(apiRateLimiter);
    registerRoutes(app);

    // 404 HANDLER (for unmatched routes)
    app.use((req: Request, res: Response, next: NextFunction) => {
        next(new NotFoundError(`Cannot find ${req.method} ${req.originalUrl} on this server.`));
    });

    // ERROR HANDLER (must be after all routes and middleware)
    app.use(errorHandler);

    return app;
};