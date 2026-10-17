import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  assignCustomers,
  unassignCustomer,
  getUserAssignments,
  getAuditLogs,
} from '../controllers/user.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All user management routes require authentication
router.use(requireAuth);

// View assignments (Admin can view any user; Partner can only view their own)
router.get('/:id/assignments', getUserAssignments);

// Administrative management endpoints strictly require Admin role
router.use(requireAdmin);
router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/assignments', assignCustomers);
router.post('/unassign', unassignCustomer);
router.get('/audit-logs', getAuditLogs);

export default router;
