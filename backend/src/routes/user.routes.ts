import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  assignCustomers,
  unassignCustomer,
  getAuditLogs,
} from '../controllers/user.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// All user management routes strictly require authentication AND Admin role
router.use(requireAuth, requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/assignments', assignCustomers);
router.post('/unassign', unassignCustomer);
router.get('/audit-logs', getAuditLogs);

export default router;
