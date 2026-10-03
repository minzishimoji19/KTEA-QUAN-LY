import { Router } from 'express';
import { updateNote, deleteNote } from '../controllers/note.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { updateNoteSchema, noteIdParamSchema } from '../validations/note.validation.js';

const router = Router();

router.patch(
  '/:id',
  validateRequest({ params: noteIdParamSchema, body: updateNoteSchema }),
  updateNote
);

router.delete(
  '/:id',
  validateRequest({ params: noteIdParamSchema }),
  deleteNote
);

export default router;
