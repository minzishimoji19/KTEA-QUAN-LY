import { Request, Response, NextFunction } from 'express';
import { tagService } from '../services/tag.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getTags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tags = await tagService.getAllTags();
    sendSuccess(res, tags, 'Tags retrieved');
  } catch (error) {
    next(error);
  }
};

export const createTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tag = await tagService.createTag(req.body);
    sendCreated(res, tag, 'Tag created');
  } catch (error) {
    next(error);
  }
};

export const updateTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tag = await tagService.updateTag(req.params.id, req.body);
    sendSuccess(res, tag, 'Tag updated');
  } catch (error) {
    next(error);
  }
};

export const deleteTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await tagService.deleteTag(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Tag deleted');
  } catch (error) {
    next(error);
  }
};
