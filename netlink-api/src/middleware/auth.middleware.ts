import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/jwt.service";
import { COOKIE_NAME } from "../utils/cookies";
import { UnauthorizedError } from "../utils/errors";

// INTERFACE FOR AUTH REQUEST
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

// AUTH MIDDLEWARE TO PROTECT ROUTES.
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {

    const token = req.cookies[COOKIE_NAME];

    if (!token) {
        return next(new UnauthorizedError('Authentication cookie missing.'));
    }

    try {
        // VERIFY TOKEN AND ATTACH PAYLOAD TO REQ.USER
        const payload = verifyToken(token);

        // ATTACH USER INFO TO REQUEST OBJECT FOR USE IN CONTROLLERS
        req.user = {
            id: payload.id,
            email: payload.email
        };

        next();
    } catch (err) {
        return next(new UnauthorizedError('Invalid or Expired Token.'));
    }
};