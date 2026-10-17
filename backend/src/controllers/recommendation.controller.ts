import { Request, Response, NextFunction } from 'express';
import { recommendationService } from '../services/recommendation.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { RecommendationStatus, Role } from '@prisma/client';
import { customerAccessService } from '../services/customerAccess.service.js';
import { ForbiddenError } from '../utils/errors.js';

export const getAllRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, minScore, productId } = req.query as {
      status?: RecommendationStatus;
      minScore?: any;
      productId?: string;
    };

    let scopedCustomerIds: string[] | undefined;
    if (req.user && req.user.role === Role.PARTNER) {
      scopedCustomerIds = await customerAccessService.getAssignedCustomerIds(req.user.userId);
    }

    const recommendations = await recommendationService.getAllRecommendations({
      status,
      minScore: minScore !== undefined ? Number(minScore) : undefined,
      productId,
      scopedCustomerIds,
    });
    sendSuccess(res, recommendations, 'System recommendations loaded');
  } catch (error) {
    next(error);
  }
};

export const getRecommendationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertRecommendationAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const recommendation = await recommendationService.getRecommendationById(req.params.id);
    sendSuccess(res, recommendation, 'Recommendation detail loaded');
  } catch (error) {
    next(error);
  }
};

export const getRecommendationsByCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const recommendations = await recommendationService.getRecommendationsByCustomerId(
      req.params.id
    );
    sendSuccess(res, recommendations, 'Customer recommendations loaded');
  } catch (error) {
    next(error);
  }
};

export const generateRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { customerId } = req.body as { customerId?: string };
    if (!customerId) {
      if (req.user && req.user.role === Role.PARTNER) {
        throw new ForbiddenError('Đối tác không có quyền chạy đề xuất toàn hệ thống');
      }
      const result = await recommendationService.generateForAll();
      sendCreated(res, result, 'Batch recommendations generated');
    } else {
      if (req.user) {
        await customerAccessService.assertCustomerAccess(
          { id: req.user.userId, role: req.user.role },
          customerId
        );
      }
      const result = await recommendationService.generateForCustomer(customerId);
      sendCreated(res, result, 'Recommendations generated for customer');
    }
  } catch (error) {
    next(error);
  }
};

export const reviewRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertRecommendationAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const result = await recommendationService.reviewRecommendation(req.params.id);
    sendSuccess(res, result, 'Recommendation marked as reviewed');
  } catch (error) {
    next(error);
  }
};

export const dismissRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertRecommendationAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const result = await recommendationService.dismissRecommendation(req.params.id);
    sendSuccess(res, result, 'Recommendation dismissed');
  } catch (error) {
    next(error);
  }
};

export const convertToPush = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertRecommendationAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const result = await recommendationService.convertToPush(req.params.id, req.body);
    sendCreated(res, result, 'Recommendation converted to referral push successfully');
  } catch (error) {
    next(error);
  }
};
