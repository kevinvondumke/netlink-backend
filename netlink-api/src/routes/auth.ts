import { Router } from "express";
import { login, logout, register } from "../controllers/auth.controller";
import { authRateLimiter } from "../middleware/rate-limit";
import { validateRequest } from "../middleware/validate";
import { loginSchema, registerSchema } from "../schemas";

const router = Router();

// LOGIN ROUTE
router.post('/login', authRateLimiter, validateRequest(loginSchema), login);

// REGISTER ROUTE
router.post('/register', authRateLimiter, validateRequest(registerSchema), register);

// LOGOUT ROUTE
router.post('/logout', authRateLimiter, logout);

export default router;