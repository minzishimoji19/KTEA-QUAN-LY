import { Request, Response, NextFunction } from 'express';
import { noteService } from '../services/note.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getNotesByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notes = await noteService.getNotesByCustomerId(req.params.id);
    sendSuccess(res, notes, 'Customer notes loaded');
  } catch (error) {
    next(error);
  }
};

export const createNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const note = await noteService.createNote(req.params.id, req.body.content);
    sendCreated(res, note, 'Note created');
  } catch (error) {
    next(error);
  }
};

export const updateNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const note = await noteService.updateNote(req.params.id, req.body.content);
    sendSuccess(res, note, 'Note updated');
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await noteService.deleteNote(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Note deleted');
  } catch (error) {
    next(error);
  }
};
