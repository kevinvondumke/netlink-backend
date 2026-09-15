import { Router } from 'express';
import { getLiveness, getReadiness } from '../controllers/health.controller';

const router = Router();

// LIVENESS PROBE
router.get('/health', getLiveness);

// READINESS PROBE
router.get('/ready', getReadiness); 

export default router;