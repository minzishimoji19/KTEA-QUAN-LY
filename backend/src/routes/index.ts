import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
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
import customerSourceRoutes from './customerSource.routes.js';
import pushNotificationRoutes from './pushNotification.routes.js';
import caretakerRoutes from './caretaker.routes.js';
import questionnaireRoutes from './questionnaire.routes.js';
import assessmentRoutes from './assessment.routes.js';
import assessmentRecommendationRoutes from './assessmentRecommendation.routes.js';
import {
  staffSurveyRouter,
  surveyLinkManagementRouter,
  publicSurveyRouter,
} from './publicSurvey.routes.js';
import {
  publicAkinatorRouter,
  adminAkinatorRouter,
} from './akinator.routes.js';
import { revokeCustomerAkinatorSessionHandler } from '../controllers/akinator.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Health check endpoint (public, sanitized)
router.use(healthRoutes);

// Authentication Endpoints (public login / session check)
router.use('/auth', authRoutes);

// Web Push Notification Endpoints (cron has x-cron-secret, vapid-key public, subscription endpoints)
router.use('/notifications', pushNotificationRoutes);

// Public Survey Endpoints (unauthenticated, token-only auth)
router.use('/public/survey', publicSurveyRouter);

// Public Akinator Quiz Endpoints (unauthenticated, token-scoped, rate-limited)
router.use('/public/akinator', publicAkinatorRouter);

// Admin Akinator Management & Workflow Endpoints (authenticated, ADMIN only)
router.use('/akinator', requireAuth, adminAkinatorRouter);

// Staff Akinator Link Management (authenticated, RBAC scoped)
router.post('/akinator-sessions/:sessionId/revoke', requireAuth, revokeCustomerAkinatorSessionHandler);

// User & Role Management (authenticated, admin-only routes inside)
router.use('/users', requireAuth, userRoutes);

// Protected Core Resource Endpoints
router.use('/customers', requireAuth, customerRoutes);
router.use('/cases', requireAuth, caseRoutes);
router.use('/customer-sources', requireAuth, customerSourceRoutes);
router.use('/caretakers', requireAuth, caretakerRoutes);
router.use('/needs', requireAuth, needRoutes);
router.use('/notes', requireAuth, noteRoutes);
router.use('/tags', requireAuth, tagRoutes);
router.use('/follow-ups', requireAuth, followUpRoutes);
router.use('/products', requireAuth, productRoutes);
router.use('/questionnaires', requireAuth, questionnaireRoutes);
router.use('/assessments', requireAuth, assessmentRoutes);
router.use('/', assessmentRecommendationRoutes);
router.use('/push-records', requireAuth, pushRecordRoutes);
router.use('/recommendations', requireAuth, recommendationRoutes);

// Public Survey: staff management routes (authenticated)
router.use('/customers/:customerId/survey-links', requireAuth, staffSurveyRouter);
router.use('/survey-links', requireAuth, surveyLinkManagementRouter);

// Analytics, Dashboard, Settings & Data Governance Endpoints
router.use('/analytics', requireAuth, analyticsRoutes);
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/settings', requireAuth, settingsRoutes);
router.use('/data', requireAuth, dataRoutes);

export default router;


