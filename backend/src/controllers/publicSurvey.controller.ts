/**
 * publicSurvey.controller.ts
 * Handles both staff (authenticated) and public (token-only) endpoints.
 * NEVER returns raw tokens except at creation time.
 * NEVER returns customer PII on public endpoints.
 */
import { Request, Response, NextFunction } from 'express';
import { publicSurveyService } from '../services/publicSurvey.service.js';
import { customerAccessService } from '../services/customerAccess.service.js';
import {
  createPublicSurveyLinkSchema,
  publicSurveyTokenParamSchema,
  publicSaveAnswersSchema,
  publicCompleteSchema,
  linkIdParamSchema,
  customerIdParamSchema,
} from '../validations/publicSurvey.validation.js';
import { BadRequestError } from '../utils/errors.js';

// ---------------------------------------------------------------------------
// Staff endpoints (require auth)
// ---------------------------------------------------------------------------

export async function createPublicSurveyLink(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerId } = customerIdParamSchema.parse(req.params);
    const input = createPublicSurveyLinkSchema.parse(req.body);

    const user = req.user!;
    const userCtx = { id: user.userId, role: user.role, email: user.email };
    const result = await publicSurveyService.createLink(customerId, input, userCtx);

    // Build the public URL from environment; fallback to relative path
    const frontendOrigin = process.env.FRONTEND_API_URL || 'https://ktea-quan-ly.vercel.app';
    const publicUrl = `${frontendOrigin}/survey/${result.rawToken}`;

    res.status(201).json({
      data: {
        linkId: result.linkId,
        publicUrl,
        rawToken: result.rawToken,
        assessmentId: result.assessmentId,
        expiresAt: result.expiresAt,
        status: result.status,
        questionnaire: result.questionnaire,
        createdBy: result.createdBy,
        createdAt: result.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listPublicSurveyLinks(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerId } = customerIdParamSchema.parse(req.params);
    const user = req.user!;
    const userCtx = { id: user.userId, role: user.role, email: user.email };
    const links = await publicSurveyService.listLinksByCustomer(customerId, userCtx);
    res.json({ data: links });
  } catch (err) {
    next(err);
  }
}

export async function getPublicSurveyLink(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { linkId } = linkIdParamSchema.parse(req.params);
    const user = req.user!;
    const userCtx = { id: user.userId, role: user.role, email: user.email };
    const link = await publicSurveyService.getLinkById(linkId, userCtx);
    res.json({ data: link });
  } catch (err) {
    next(err);
  }
}

export async function revokePublicSurveyLink(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { linkId } = linkIdParamSchema.parse(req.params);
    const user = req.user!;
    const userCtx = { id: user.userId, role: user.role, email: user.email };
    await publicSurveyService.revokeLink(linkId, userCtx);
    res.json({ data: { revoked: true } });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public endpoints (token-only auth, no CRM session required)
// ---------------------------------------------------------------------------

/**
 * GET /api/public/survey/:token
 * Returns questionnaire structure + existing answers. No customer PII.
 */
export async function getPublicSurveyData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = publicSurveyTokenParamSchema.parse(req.params);
    const { link, effectiveStatus } = await publicSurveyService.getPublicSurveyInfo(token);

    const version = link.assessment.questionnaireVersion;
    const questionnaire = version.questionnaire;

    // Sanitize: only return what the customer needs to fill the form
    const responseData = {
      linkId: link.id,
      status: effectiveStatus,
      expiresAt: link.expiresAt,
      questionnaire: {
        title: questionnaire.title,
        description: questionnaire.description,
        versionNumber: version.versionNumber,
        versionTitle: version.title ?? questionnaire.title,
      },
      questions: version.questions.map((q) => ({
        id: q.id,
        code: q.code,
        questionText: q.questionText,
        description: q.description,
        questionType: q.questionType,
        isRequired: q.isRequired,
        displayOrder: q.displayOrder,
        options: q.options,
        validationConfig: q.validationConfig,
        conditionalLogic: q.conditionalLogic,
      })),
      savedAnswers: link.assessment.answers.map((a) => ({
        questionCode: a.questionCode,
        answerValue: a.answerValue,
      })),
      assessmentStatus: link.assessment.status,
    };

    // Prevent caching of sensitive survey data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json({ data: responseData });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/public/survey/:token/answers
 * Save draft answers (partial, idempotent, debounce-friendly).
 */
export async function publicSaveAnswers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = publicSurveyTokenParamSchema.parse(req.params);
    const { answers } = publicSaveAnswersSchema.parse(req.body);

    const result = await publicSurveyService.publicSaveAnswers(
      token,
      answers as Array<{ questionCode: string; questionId?: string | null; answerValue: any }>
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/public/survey/:token/complete
 * Complete the survey — strict validation, atomic transaction.
 */
export async function publicCompleteAssessment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token } = publicSurveyTokenParamSchema.parse(req.params);
    const { answers } = publicCompleteSchema.parse(req.body);

    const result = await publicSurveyService.publicCompleteAssessment(
      token,
      answers as Array<{ questionCode: string; questionId?: string | null; answerValue: any }> | undefined
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
