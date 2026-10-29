/**
 * AkinatorQuizPage.tsx
 *
 * Public interactive quiz flow for the independent Akinator module.
 * Route: /akinator/quiz (or /akinator/quiz/:token)
 *
 * Strict Principles (Phase 3):
 * 1. ZERO client-side Question Engine or Rule Engine.
 *    The next question and evaluation results are determined 100% by the Backend.
 * 2. Mobile-first, distraction-free, accessible design matching KTEA CRM.
 * 3. Idempotent submission, double-click prevention, network retry resilience.
 * 4. Transparent preliminary reference disclaimer (no loan guarantee claims).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ShieldCheck,
  Clock,
  Compass,
  AlertCircle,
  Check,
} from 'lucide-react';
import { akinatorPublicApi } from '../services/akinatorService';
import {
  AkinatorPublicQuestion,
  AkinatorQuizProgress,
  AkinatorPublicResult,
  AkinatorQuestionOption,
} from '../types/akinator';
import { VietnameseDatePicker } from '../components/ui/VietnameseDatePicker';

type PageFlowState =
  | 'loading'
  | 'intro'
  | 'answering'
  | 'ready_to_complete'
  | 'result'
  | 'error';

function formatVND(value: number): string {
  if (isNaN(value)) return '';
  return new Intl.NumberFormat('vi-VN').format(value);
}

function parseFormattedVND(str: string): number {
  const clean = str.replace(/[^\d]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

function readVietnameseCurrencyWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '';
  const billions = Math.floor(num / 1_000_000_000);
  const remainderAfterBillions = num % 1_000_000_000;
  const millions = Math.floor(remainderAfterBillions / 1_000_000);
  const remainderAfterMillions = remainderAfterBillions % 1_000_000;
  const thousands = Math.floor(remainderAfterMillions / 1_000);

  const parts: string[] = [];
  if (billions > 0) parts.push(`${billions} tỷ`);
  if (millions > 0) parts.push(`${millions} triệu`);
  if (thousands > 0) parts.push(`${thousands} nghìn`);
  return parts.length > 0 ? `${parts.join(' ')} đồng` : '';
}

const COMMON_CURRENCY_PILLS = [
  { label: '30 triệu', value: 30_000_000 },
  { label: '50 triệu', value: 50_000_000 },
  { label: '100 triệu', value: 100_000_000 },
  { label: '300 triệu', value: 300_000_000 },
  { label: '500 triệu', value: 500_000_000 },
  { label: '1 tỷ', value: 1_000_000_000 },
  { label: '2 tỷ', value: 2_000_000_000 },
];

export const AkinatorQuizPage: React.FC = () => {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const effectiveToken = routeToken || searchParams.get('token') || sessionStorage.getItem('akinator_session_token') || '';

  const [flowState, setFlowState] = useState<PageFlowState>('loading');
  const [sessionToken, setSessionToken] = useState<string>(effectiveToken);
  const [configTitle, setConfigTitle] = useState<string>('Khảo sát & Đánh giá Nhu cầu Tài chính Thích ứng');
  const [configDescription, setConfigDescription] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AkinatorPublicQuestion | null>(null);
  const [progress, setProgress] = useState<AkinatorQuizProgress>({
    answeredCount: 0,
    remainingEligibleCount: 1,
    maxQuestionsPerSession: 15,
  });
  const [currentAnswer, setCurrentAnswer] = useState<any>('');
  const [result, setResult] = useState<AkinatorPublicResult | null>(null);
  const [disclaimerText, setDisclaimerText] = useState<string>(
    'Kết quả trên chỉ mang tính chất tham khảo sơ bộ dựa trên thông tin bạn cung cấp, không phải cam kết phê duyệt khoản vay hay hạn mức tín dụng chính thức.'
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resume or load session
  const loadExistingSession = useCallback(async (token: string) => {
    try {
      setFlowState('loading');
      setErrorMessage(null);
      const data = await akinatorPublicApi.getSessionByToken(token);

      if (data.title) setConfigTitle(data.title);
      if (data.description) setConfigDescription(data.description);
      if (data.disclaimerText) setDisclaimerText(data.disclaimerText);

      if (data.quizStatus === 'COMPLETED' && data.result) {
        setResult(data.result);
        setFlowState('result');
        return;
      }

      if (data.progress) {
        setProgress(data.progress);
      }

      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setCurrentAnswer(
          data.nextQuestion.questionType === 'MULTIPLE_CHOICE'
            ? []
            : data.nextQuestion.questionType === 'YES_NO'
            ? null
            : ''
        );
        setFlowState('answering');
      } else if (data.readyToComplete) {
        setFlowState('ready_to_complete');
      } else {
        setFlowState('intro');
      }
    } catch (err: any) {
      console.warn('Failed to resume Akinator session:', err);
      // Clean stale invalid token
      sessionStorage.removeItem('akinator_session_token');
      setSessionToken('');
      setFlowState('intro');
    }
  }, []);

  useEffect(() => {
    if (effectiveToken) {
      loadExistingSession(effectiveToken);
    } else {
      setFlowState('intro');
    }
  }, [effectiveToken, loadExistingSession]);

  // Start new quiz session
  const handleStartQuiz = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const data = await akinatorPublicApi.startSession();

      setSessionToken(data.sessionToken);
      sessionStorage.setItem('akinator_session_token', data.sessionToken);
      setSearchParams({ token: data.sessionToken });

      if (data.title) setConfigTitle(data.title);
      if (data.description) setConfigDescription(data.description);
      if (data.disclaimerText) setDisclaimerText(data.disclaimerText);
      setProgress(data.progress);

      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setCurrentAnswer(
          data.nextQuestion.questionType === 'MULTIPLE_CHOICE'
            ? []
            : data.nextQuestion.questionType === 'YES_NO'
            ? null
            : ''
        );
        setFlowState('answering');
      } else {
        setFlowState('ready_to_complete');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể khởi tạo phiên đánh giá. Vui lòng thử lại sau.');
      setFlowState('intro');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit answer to Backend
  const handleSubmitAnswer = async () => {
    if (isSubmitting || !currentQuestion || !sessionToken) return;

    // Client-side quick check
    if (
      currentAnswer === undefined ||
      currentAnswer === null ||
      (typeof currentAnswer === 'string' && currentAnswer.trim() === '') ||
      (Array.isArray(currentAnswer) && currentAnswer.length === 0)
    ) {
      setErrorMessage('Vui lòng chọn hoặc nhập câu trả lời trước khi tiếp tục');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const resp = await akinatorPublicApi.submitAnswer(
        sessionToken,
        currentQuestion.code,
        currentAnswer
      );

      setProgress(resp.progress);

      if (resp.nextQuestion) {
        setCurrentQuestion(resp.nextQuestion);
        setCurrentAnswer(
          resp.nextQuestion.questionType === 'MULTIPLE_CHOICE'
            ? []
            : resp.nextQuestion.questionType === 'YES_NO'
            ? null
            : ''
        );
        setFlowState('answering');
      } else if (resp.readyToComplete) {
        setCurrentQuestion(null);
        setFlowState('ready_to_complete');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi khi gửi câu trả lời. Vui lòng bấm thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Complete session and fetch preliminary result
  const handleCompleteQuiz = async () => {
    if (isSubmitting || !sessionToken) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const resp = await akinatorPublicApi.completeSession(sessionToken);
      setResult(resp.result);
      setFlowState('result');
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể hoàn tất phiên đánh giá. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset quiz
  const handleRestartQuiz = () => {
    sessionStorage.removeItem('akinator_session_token');
    setSessionToken('');
    setCurrentQuestion(null);
    setCurrentAnswer('');
    setResult(null);
    setErrorMessage(null);
    setSearchParams({});
    setFlowState('intro');
  };

  // Safe progress percentage
  const progressPercent = useMemo(() => {
    if (!progress.maxQuestionsPerSession || progress.maxQuestionsPerSession <= 0) return 0;
    const answered = progress.answeredCount || 0;
    const estTotal = Math.min(
      progress.maxQuestionsPerSession,
      answered + (progress.remainingEligibleCount || 1)
    );
    const pct = Math.round((answered / Math.max(answered + 1, estTotal)) * 100);
    return Math.min(100, Math.max(5, pct));
  }, [progress]);

  // Is submit button disabled
  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (currentAnswer === undefined || currentAnswer === null) return true;
    if (typeof currentAnswer === 'string' && currentAnswer.trim() === '') return true;
    if (Array.isArray(currentAnswer) && currentAnswer.length === 0) return true;
    return false;
  }, [currentAnswer, isSubmitting]);

  // Render Question Inputs according to questionType
  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    switch (currentQuestion.questionType) {
      case 'SINGLE_CHOICE': {
        const options: AkinatorQuestionOption[] = currentQuestion.options || [];
        return (
          <div className="space-y-3">
            {options.map((opt) => {
              const isSelected = String(currentAnswer) === String(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setCurrentAnswer(opt.value);
                    setErrorMessage(null);
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 text-blue-100 ring-1 ring-blue-500/50 shadow-md shadow-blue-950/40'
                      : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'border-blue-400 bg-blue-500 text-white'
                        : 'border-slate-600 bg-slate-950'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm md:text-base leading-snug">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );
      }

      case 'MULTIPLE_CHOICE': {
        const options: AkinatorQuestionOption[] = currentQuestion.options || [];
        const selectedArr: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 italic">
              * Có thể chọn một hoặc nhiều phương án phù hợp:
            </p>
            {options.map((opt) => {
              const isSelected = selectedArr.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selectedArr.filter((v) => v !== opt.value)
                      : [...selectedArr, opt.value];
                    setCurrentAnswer(next);
                    setErrorMessage(null);
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 text-blue-100 ring-1 ring-blue-500/50'
                      : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'border-blue-400 bg-blue-500 text-white'
                        : 'border-slate-600 bg-slate-950'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm md:text-base leading-snug">
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {opt.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );
      }

      case 'YES_NO': {
        return (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setCurrentAnswer(true);
                setErrorMessage(null);
              }}
              className={`p-6 rounded-xl border font-semibold text-base transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
                currentAnswer === true
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-950/40'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                  currentAnswer === true
                    ? 'border-emerald-400 bg-emerald-500 text-white'
                    : 'border-slate-600 bg-slate-950'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span>Có</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentAnswer(false);
                setErrorMessage(null);
              }}
              className={`p-6 rounded-xl border font-semibold text-base transition-all duration-150 flex flex-col items-center justify-center gap-2 ${
                currentAnswer === false
                  ? 'bg-slate-700/40 border-slate-500 text-slate-200 ring-1 ring-slate-400/50 shadow-lg'
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                  currentAnswer === false
                    ? 'border-slate-400 bg-slate-500 text-white'
                    : 'border-slate-600 bg-slate-950'
                }`}
              >
                <span className="text-sm font-bold">✕</span>
              </div>
              <span>Không</span>
            </button>
          </div>
        );
      }

      case 'CURRENCY': {
        const numericVal = typeof currentAnswer === 'number' ? currentAnswer : parseFormattedVND(String(currentAnswer || ''));
        const words = readVietnameseCurrencyWords(numericVal);

        return (
          <div className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={numericVal > 0 ? formatVND(numericVal) : ''}
                  onChange={(e) => {
                    const parsed = parseFormattedVND(e.target.value);
                    setCurrentAnswer(parsed);
                    setErrorMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSubmitDisabled) {
                      e.preventDefault();
                      handleSubmitAnswer();
                    }
                  }}
                  placeholder="Ví dụ: 50.000.000"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 text-xl font-semibold px-4 py-3.5 rounded-xl outline-none tracking-wide"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-mono font-medium">
                  VNĐ
                </span>
              </div>
              {words && (
                <p className="text-xs text-blue-400 mt-2 font-medium italic">
                  ≈ {words}
                </p>
              )}
            </div>

            {/* Quick amount suggestion chips */}
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                Gợi ý nhanh số tiền:
              </p>
              <div className="flex flex-wrap gap-2">
                {COMMON_CURRENCY_PILLS.map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => {
                      setCurrentAnswer(pill.value);
                      setErrorMessage(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      numericVal === pill.value
                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'NUMBER': {
        const valConfig = currentQuestion.validationConfig || {};
        return (
          <div className="space-y-2">
            <input
              type="number"
              min={valConfig.min}
              max={valConfig.max}
              value={currentAnswer !== null && currentAnswer !== undefined ? currentAnswer : ''}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                setCurrentAnswer(val);
                setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitDisabled) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              placeholder="Nhập số..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 text-lg px-4 py-3.5 rounded-xl outline-none"
            />
            {(valConfig.min !== undefined || valConfig.max !== undefined) && (
              <p className="text-xs text-slate-400">
                {valConfig.min !== undefined && `Tối thiểu: ${valConfig.min}`}
                {valConfig.min !== undefined && valConfig.max !== undefined && ' — '}
                {valConfig.max !== undefined && `Tối đa: ${valConfig.max}`}
              </p>
            )}
          </div>
        );
      }

      case 'DATE': {
        const valConfig = currentQuestion.validationConfig || {};
        return (
          <div className="space-y-2">
            <VietnameseDatePicker
              value={currentAnswer ? String(currentAnswer) : null}
              onChange={(iso) => {
                setCurrentAnswer(iso);
                setErrorMessage(null);
              }}
              minDate={valConfig.minDate}
              maxDate={valConfig.maxDate}
              variant="dark"
              size="lg"
              placeholder="dd/MM/yyyy"
            />
            <p className="text-xs text-slate-400">
              Định dạng chuẩn: ngày/tháng/năm (ví dụ: 15/08/1990)
            </p>
          </div>
        );
      }

      case 'TEXT':
      default: {
        const valConfig = currentQuestion.validationConfig || {};
        return (
          <div className="space-y-2">
            <input
              type="text"
              maxLength={valConfig.maxLength || 500}
              value={currentAnswer !== null && currentAnswer !== undefined ? String(currentAnswer) : ''}
              onChange={(e) => {
                setCurrentAnswer(e.target.value);
                setErrorMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitDisabled) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              placeholder="Nhập nội dung trả lời..."
              className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 text-base px-4 py-3.5 rounded-xl outline-none"
            />
            {valConfig.maxLength && (
              <p className="text-xs text-slate-500 text-right">
                {String(currentAnswer || '').length}/{valConfig.maxLength} ký tự
              </p>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 md:p-6 font-sans">
      {/* Background ambient gradient */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />

      <div className="w-full max-w-xl z-10">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-wide text-slate-200">
                KTEA Akinator
              </span>
              <span className="text-[10px] text-blue-400 font-mono block tracking-tight">
                Hệ thống Khảo sát Thích ứng
              </span>
            </div>
          </div>

          {sessionToken && flowState !== 'intro' && (
            <button
              onClick={handleRestartQuiz}
              title="Làm lại từ đầu"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Bắt đầu lại</span>
            </button>
          )}
        </div>

        {/* Main Card Container */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 md:p-7 shadow-2xl shadow-black/80 backdrop-blur-md">
          {/* ========================================================================= */}
          {/* STATE: LOADING */}
          {/* ========================================================================= */}
          {flowState === 'loading' && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-300">
                Đang tải phiên khảo sát Akinator...
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE: INTRO */}
          {/* ========================================================================= */}
          {flowState === 'intro' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Khảo sát nhu cầu tự động</span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-100">
                  {configTitle}
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                  {configDescription ||
                    'Trả lời nhanh một số câu hỏi thích ứng để hệ thống đối chiếu và đưa ra nhóm nhu cầu tài chính sơ bộ phù hợp nhất.'}
                </p>
              </div>

              {/* Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl text-center space-y-1">
                  <Sparkles className="w-4 h-4 text-amber-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-200">
                    Thích ứng thông minh
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Câu hỏi tự điều chỉnh theo lựa chọn
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl text-center space-y-1">
                  <Clock className="w-4 h-4 text-blue-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-200">
                    Chỉ 1 - 2 phút
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Ngắn gọn, trọng tâm, không mất thời gian
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl text-center space-y-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto" />
                  <div className="text-xs font-semibold text-slate-200">
                    Bảo mật tuyệt đối
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Dữ liệu được mã hóa và bảo vệ an toàn
                  </div>
                </div>
              </div>

              {/* Disclaimer Preview Notice */}
              <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 text-xs text-slate-400 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  {disclaimerText}
                </span>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleStartQuiz}
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang khởi tạo...</span>
                  </>
                ) : (
                  <>
                    <span>Bắt đầu đánh giá ngay</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE: ANSWERING (ACTIVE QUESTION) */}
          {/* ========================================================================= */}
          {flowState === 'answering' && currentQuestion && (
            <div className="space-y-6">
              {/* Progress header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium text-slate-300">
                    Câu hỏi số {progress.answeredCount + 1}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Đã trả lời {progress.answeredCount} câu
                  </span>
                </div>
                {/* Honest Real Progress Bar */}
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5 pt-1">
                <h2 className="text-base md:text-lg font-semibold text-slate-100 leading-snug">
                  {currentQuestion.questionText}
                </h2>
                {currentQuestion.description && (
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    {currentQuestion.description}
                  </p>
                )}
              </div>

              {/* Dynamic Inputs */}
              <div className="py-2">
                {renderQuestionInput()}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitDisabled}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang đối chiếu câu hỏi tiếp theo...</span>
                    </>
                  ) : (
                    <>
                      <span>Tiếp tục</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE: READY TO COMPLETE */}
          {/* ========================================================================= */}
          {flowState === 'ready_to_complete' && (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg md:text-xl font-bold text-slate-100">
                  Đã thu thập đủ thông tin đánh giá
                </h2>
                <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Thuật toán Akinator đã có đủ dữ liệu từ các câu trả lời của bạn để chạy phân tích sơ bộ.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCompleteQuiz}
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Hệ thống đang chạy Rule Engine đánh giá...</span>
                  </>
                ) : (
                  <>
                    <span>Xem kết quả đánh giá sơ bộ</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE: RESULT SCREEN */}
          {/* ========================================================================= */}
          {flowState === 'result' && result && (
            <div className="space-y-6">
              {/* Result Status Header */}
              {result.evaluationStatus === 'EVALUATED' ? (
                <div className="text-center space-y-2 pb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã hoàn tất đánh giá sơ bộ</span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-100">
                    {result.summaryTitle}
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {result.summaryDescription}
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-2 pb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Chưa đủ thông tin để kết luận</span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-100">
                    {result.summaryTitle || 'Cần bổ sung thêm thông tin'}
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {result.summaryDescription ||
                      'Dữ liệu hiện tại chưa đủ để hệ thống khớp với nhóm giải pháp cụ thể.'}
                  </p>
                </div>
              )}

              {/* Matched Categories (if EVALUATED) */}
              {result.evaluationStatus === 'EVALUATED' &&
                result.outcomeData?.categories &&
                result.outcomeData.categories.length > 0 && (
                  <div className="space-y-4">
                    {result.outcomeData.categories.map((cat, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-semibold tracking-wider text-blue-400 uppercase font-mono">
                              {cat.categoryLabel || 'Nhóm nhu cầu phù hợp'}
                            </span>
                            <h3 className="font-semibold text-sm text-slate-100 mt-0.5">
                              {cat.referenceTitle}
                            </h3>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {cat.referenceSummary}
                        </p>

                        {/* Suggested Directions */}
                        {cat.suggestedDirections && cat.suggestedDirections.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Compass className="w-3 h-3 text-blue-400" />
                              <span>Gợi ý hướng tiếp theo:</span>
                            </span>
                            <ul className="space-y-1">
                              {cat.suggestedDirections.map((step, sIdx) => (
                                <li
                                  key={sIdx}
                                  className="text-xs text-slate-300 flex items-start gap-2"
                                >
                                  <span className="text-blue-400 text-xs">•</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Caution Notes */}
                        {cat.cautionNotes && cat.cautionNotes.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1">
                            <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Lưu ý:</span>
                            </span>
                            <ul className="space-y-1">
                              {cat.cautionNotes.map((note, nIdx) => (
                                <li
                                  key={nIdx}
                                  className="text-xs text-slate-400 flex items-start gap-2"
                                >
                                  <span className="text-amber-400 text-xs">•</span>
                                  <span>{note}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {/* Missing Criteria (if INSUFFICIENT_DATA) */}
              {result.evaluationStatus === 'INSUFFICIENT_DATA' &&
                result.missingCriteria &&
                result.missingCriteria.length > 0 && (
                  <div className="bg-slate-950/80 border border-amber-900/30 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">
                      Thông tin cần trao đổi thêm khi liên hệ tư vấn:
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {result.missingCriteria.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400">•</span>
                          <span>
                            <strong>{item.questionText}:</strong> {item.reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Mandatory Reference Disclaimer Alert */}
              <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-4 space-y-1.5 text-amber-200">
                <div className="flex items-center gap-2 font-semibold text-xs tracking-wide uppercase text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Khuyến cáo tham khảo quan trọng</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  {result.disclaimerText || disclaimerText}
                </p>
              </div>

              {/* Restart Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRestartQuiz}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm border border-slate-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Làm lại bài đánh giá mới</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} KTEA CRM — Phân hệ Đánh giá Thích ứng Akinator
        </div>
      </div>
    </div>
  );
};

export default AkinatorQuizPage;
