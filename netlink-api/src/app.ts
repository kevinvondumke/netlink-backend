import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error';
import { apiRateLimiter } from './middleware/rate-limit';
import { NotFoundError } from './utils/errors';

export const createApp = () => {
    const app = express();

    // SECURITY MIDDLEWARE
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

    // JSON PARSER AND COOKIE PARSER MIDDLEWARE
    app.use(express.json());
    app.use(cookieParser());

    // HEALTH ROUTES
    app.use(healthRouter);

    // APPLICATION ROUTES
    app.use(apiRateLimiter);
    registerRoutes(app);

    // 404 HANDLER
    app.use((req: Request, res: Response, next: NextFunction) => {
        next(new NotFoundError(`Cannot find ${req.method} ${req.originalUrl} on this server.`));
    });

    // ERROR HANDLER
    app.use(errorHandler);

    return app;
};