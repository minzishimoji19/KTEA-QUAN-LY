import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  assignCustomers,
  unassignCustomer,
  getUserAssignments,
  getAuditLogs,
  linkUserCaretaker,
  getCaregivers,
} from '../controllers/user.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All user management routes require authentication
router.use(requireAuth);

// Caregiver list for scheduling follow-ups (accessible to any authenticated user)
router.get('/caregivers', getCaregivers);

// View assignments (Admin can view any user; Partner can only view their own)
router.get('/:id/assignments', getUserAssignments);

// Administrative management endpoints strictly require Admin role
router.use(requireAdmin);
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/link-caretaker', linkUserCaretaker);
router.post('/assignments', assignCustomers);
router.post('/unassign', unassignCustomer);
router.get('/audit-logs', getAuditLogs);

export default router;
