import { NextFunction, Request, Response } from 'express';
import { comparePassword, findUserByEmail, hashPassword, createUser } from '../services/auth.service';
import { signToken } from '../services/jwt.service';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors';
import { LoginInput, RegisterInput } from '../schemas';
import { COOKIE_NAME, getAuthCookieOptions, getClearCookieOptions } from '../utils/cookies';

// LOGIN CONTROLLER
export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = req.body as LoginInput;

        // VERIFY USER EXISTENCE
        const user = await findUserByEmail(email);
        if (!user) {
            throw new UnauthorizedError('Invalid login credentials.');
        }

        // VERIFY PASSWORD HASH
        const passCheck = await comparePassword(password, user.password);
        if (!passCheck) {
            throw new UnauthorizedError('Invalid login credentials.');
        }

        // SIGN JWT TOKEN
        const token = signToken({
            id: user.id,
            email: user.email,
        });

        // SET AUTH COOKIE + RETURN USER INFO
        res.cookie(COOKIE_NAME, token, getAuthCookieOptions());
        return res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                avatarUrl: user.avatarUrl,
                email: user.email,
            }
        });
    } catch (err) {
        next(err);
    }
}

// REGISTER CONTROLLER
export async function register(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, name, password, bio, avatarUrl } = req.body as RegisterInput;

        // VERIFY IS USER ALREADY EXISTS
        const userCheck = await findUserByEmail(email);
        if (userCheck) {
            throw new ConflictError('Email already exists.');
        }

        // HASH PASSWORD AND CREATE USER
        const hashed = await hashPassword(password);
        const user = await createUser(email, hashed, name, bio || '', avatarUrl || '');

        res.cookie(
            COOKIE_NAME,
            signToken({ id: user.id, email: user.email }),
            getAuthCookieOptions()
        );

        return res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                bio: user.bio,
                avatarUrl: user.avatarUrl,
            }
        });
    } catch (err) {
        next(err);
    }
}

// LOGOUT CONTROLLER
export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        res.clearCookie(COOKIE_NAME, getClearCookieOptions());
        return res.json({ message: 'Logged out successfully.' });
    } catch (err) {
        next(err);
    }
}