import express from 'express';
import { aiChat } from '../controllers/ai.controller.js';

const router = express.Router();

router.post('/ai-chat', aiChat);

export default router; 