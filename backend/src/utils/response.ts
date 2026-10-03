import { Response } from 'express';
import { ApiResponse, PaginatedResponse, ApiErrorResponse, PaginationMeta } from '../types/api.js';

export const sendSuccess = <T>(res: Response, data: T, message?: string, statusCode = 200): Response => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(res: Response, data: T, message = 'Resource created successfully'): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message?: string
): Response => {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    ...(message ? { message } : {}),
  };
  return res.status(200).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response => {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return res.status(statusCode).json(response);
};
