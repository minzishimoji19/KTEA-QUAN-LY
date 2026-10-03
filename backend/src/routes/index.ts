import { Router } from 'express';
import healthRoutes from './health.routes.js';
import customerRoutes from './customer.routes.js';
import caseRoutes from './case.routes.js';
import needRoutes from './need.routes.js';
import noteRoutes from './note.routes.js';
import tagRoutes from './tag.routes.js';
import followUpRoutes from './followUp.routes.js';
import productRoutes from './product.routes.js';
import pushRecordRoutes from './pushRecord.routes.js';
import recommendationRoutes from './recommendation.routes.js';
import analyticsRoutes from './analytics.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import settingsRoutes from './settings.routes.js';
import dataRoutes from './data.routes.js';

const router = Router();

// Health check endpoint
router.use(healthRoutes);

// Core Resource Endpoints
router.use('/customers', customerRoutes);
router.use('/cases', caseRoutes);
router.use('/needs', needRoutes);
router.use('/notes', noteRoutes);
router.use('/tags', tagRoutes);
router.use('/follow-ups', followUpRoutes);
router.use('/products', productRoutes);
router.use('/push-records', pushRecordRoutes);
router.use('/recommendations', recommendationRoutes);

// Analytics, Dashboard, Settings & Data Governance Endpoints
router.use('/analytics', analyticsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/settings', settingsRoutes);
router.use('/data', dataRoutes);

export default router;


