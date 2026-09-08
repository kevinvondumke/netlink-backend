import { CookieOptions } from 'express';

export const COOKIE_NAME = 'auth_token';

// COOKIE OPTIONS FOR JWT TOKEN
export const getAuthCookieOptions = (): CookieOptions => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax', // FRONT & BACK ==> CROSS SITE
        path: '/',
        maxAge: 60 * 60 * 1000, // 1h
    };
};

// COOKIE OPTIONS FOR CLEARING JWT TOKEN
export const getClearCookieOptions = (): CookieOptions => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
    };
};