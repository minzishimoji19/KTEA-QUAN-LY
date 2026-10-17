import { Request, Response, NextFunction } from 'express';
import { noteService } from '../services/note.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { customerAccessService } from '../services/customerAccess.service.js';

export const getNotesByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const notes = await noteService.getNotesByCustomerId(req.params.id);
    sendSuccess(res, notes, 'Customer notes loaded');
  } catch (error) {
    next(error);
  }
};

export const createNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const note = await noteService.createNote(req.params.id, req.body.content);
    sendCreated(res, note, 'Note created');
  } catch (error) {
    next(error);
  }
};

export const updateNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertNoteAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const note = await noteService.updateNote(req.params.id, req.body.content);
    sendSuccess(res, note, 'Note updated');
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertNoteAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    await noteService.deleteNote(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Note deleted');
  } catch (error) {
    next(error);
  }
};
