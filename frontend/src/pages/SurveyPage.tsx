/**
 * SurveyPage.tsx
 * Public-facing customer self-service questionnaire form for KTEA CRM.
 * Route: /survey/:token (No login guard — public access for customers)
 *
 * Design System: Modern Fintech, Clean White/Slate-50 theme, Mobile-First,
 * Touch-Friendly Interactive Cards (48px+ touch targets), Instant Validation,
 * Smart Vietnamese Currency Input with Words Readout & Quick Pills,
 * Autosave + Resume, Step Navigation & Animated Progress Bar.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  HelpCircle,
  Save,
  RotateCcw,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import {
  publicSurveyPublicApi,
  PublicSurveyData,
  SurveyQuestion,
} from '../services/publicSurveyService';

// ============================================================
// Types
// ============================================================
type SurveyStatus =
  | 'loading'
  | 'intro'
  | 'filling'
  | 'submitting'
  | 'completed'
  | 'expired'
  | 'revoked'
  | 'error';

type AnswerValue = string | number | boolean | string[] | null;

interface AnswerMap {
  [questionCode: string]: AnswerValue;
}

// Number of questions per step for comfortable mobile reading
const QUESTIONS_PER_STEP = 4;

// ============================================================
// Currency & Number Helpers for Vietnamese Fintech
// ============================================================
function formatVNDNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '';
  return new Intl.NumberFormat('vi-VN').format(val);
}

function parseFormattedNumber(str: string): number | null {
  const clean = str.replace(/[^\d]/g, '');
  if (!clean) return null;
  const num = parseInt(clean, 10);
  return isNaN(num) ? null : num;
}

function formatShortMoney(num: number): string {
  if (num >= 1_000_000_000) {
    const b = num / 1_000_000_000;
    return `${Number.isInteger(b) ? b : b.toFixed(1)} tỷ`;
  }
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(0)} triệu`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)} nghìn`;
  }
  return `${num} đ`;
}

function formatVietnameseCurrencyText(num: number): string {
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

  return parts.length > 0 ? `${parts.join(' ')} VNĐ` : `${num} VNĐ`;
}

// ============================================================
// Conditional Logic Evaluator (Mirrors backend validation)
// ============================================================
function isQuestionVisible(q: SurveyQuestion, answers: AnswerMap): boolean {
  if (!q.conditionalLogic || !q.conditionalLogic.dependsOnQuestionCode) return true;
  const { dependsOnQuestionCode, operator, value } = q.conditionalLogic;
  const raw = answers[dependsOnQuestionCode];

  let scalar: any = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    scalar = (raw as any).value ?? (raw as any).values ?? raw;
  }

  switch (operator) {
    case 'EQUALS':
      return String(scalar ?? '') === String(value ?? '');
    case 'NOT_EQUALS':
      return String(scalar ?? '') !== String(value ?? '');
    case 'IN':
      return Array.isArray(value) && value.some((v) => String(v) === String(scalar ?? ''));
    case 'NOT_IN':
      return Array.isArray(value) && !value.some((v) => String(v) === String(scalar ?? ''));
    case 'GREATER_THAN':
      return Number(scalar ?? 0) > Number(value ?? 0);
    case 'LESS_THAN':
      return Number(scalar ?? 0) < Number(value ?? 0);
    case 'IS_EMPTY':
      return (
        scalar === undefined ||
        scalar === null ||
        scalar === '' ||
        (Array.isArray(scalar) && scalar.length === 0)
      );
    case 'IS_NOT_EMPTY':
      return (
        scalar !== undefined &&
        scalar !== null &&
        scalar !== '' &&
        (!Array.isArray(scalar) || scalar.length > 0)
      );
    default:
      return true;
  }
}

function getVisibleQuestions(questions: SurveyQuestion[], answers: AnswerMap): SurveyQuestion[] {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

// ============================================================
// Question Renderer Component (Modern Touch-Friendly Fintech)
// ============================================================
interface QuestionRendererProps {
  question: SurveyQuestion;
  value: AnswerValue;
  onChange: (code: string, val: AnswerValue) => void;
  showError: boolean;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  showError,
}) => {
  const cfg = question.validationConfig || {};
  const isEmpty =
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  const hasError = showError && question.isRequired && isEmpty;

  switch (question.questionType) {
    // --------------------------------------------------------
    // 1. SINGLE_CHOICE: Radio Cards
    // --------------------------------------------------------
    case 'SINGLE_CHOICE': {
      const opts = question.options || [];
      const selectedValue = typeof value === 'string' ? value : '';

      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 gap-2.5">
            {opts.map((opt) => {
              const isSelected = selectedValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(question.code, opt.value)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/80 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span
                    className={`text-sm sm:text-base leading-snug ${
                      isSelected ? 'font-semibold text-blue-950' : 'font-medium text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng chọn một phương án</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 2. MULTIPLE_CHOICE: Checkbox Cards
    // --------------------------------------------------------
    case 'MULTIPLE_CHOICE': {
      const opts = question.options || [];
      const selectedList: string[] = Array.isArray(value) ? (value as string[]) : [];

      const toggleOption = (val: string) => {
        const next = selectedList.includes(val)
          ? selectedList.filter((x) => x !== val)
          : [...selectedList, val];
        onChange(question.code, next);
      };

      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 italic mb-1.5">(Có thể chọn nhiều phương án)</p>
          <div className="grid grid-cols-1 gap-2.5">
            {opts.map((opt) => {
              const isChecked = selectedList.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOption(opt.value)}
                  className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center gap-3.5 ${
                    isChecked
                      ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/80 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span
                    className={`text-sm sm:text-base leading-snug ${
                      isChecked ? 'font-semibold text-blue-950' : 'font-medium text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng chọn ít nhất một phương án</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 3. YES_NO: Dual Cards (Có / Không)
    // --------------------------------------------------------
    case 'YES_NO': {
      const isYes = value === true || value === 'YES';
      const isNo = value === false || value === 'NO';

      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onChange(question.code, true)}
              className={`h-13 sm:h-14 rounded-xl border transition-all flex items-center justify-center gap-2.5 text-sm sm:text-base font-semibold ${
                isYes
                  ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20 text-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isYes ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>Có</span>
            </button>

            <button
              type="button"
              onClick={() => onChange(question.code, false)}
              className={`h-13 sm:h-14 rounded-xl border transition-all flex items-center justify-center gap-2.5 text-sm sm:text-base font-semibold ${
                isNo
                  ? 'border-2 border-slate-700 bg-slate-100 text-slate-900 shadow-sm ring-2 ring-slate-400/20'
                  : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isNo ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <X className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span>Không</span>
            </button>
          </div>
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng chọn Có hoặc Không</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 4. CURRENCY: Money Input + Quick Pills + Text Readout
    // --------------------------------------------------------
    case 'CURRENCY': {
      const numVal = typeof value === 'number' ? value : parseFormattedNumber(String(value ?? ''));
      const displayStr = numVal !== null ? formatVNDNumber(numVal) : '';

      const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const parsed = parseFormattedNumber(raw);
        onChange(question.code, parsed);
      };

      const quickPills = [
        30000000, 50000000, 100000000, 200000000, 500000000, 1000000000,
      ];

      return (
        <div className="space-y-2.5">
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={displayStr}
              onChange={handleCurrencyChange}
              placeholder="0"
              className={`w-full h-13 sm:h-14 pl-4 pr-16 bg-white border rounded-xl text-base sm:text-lg font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all ${
                hasError ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-100' : 'border-slate-200'
              }`}
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-sm font-bold text-slate-400">
              VNĐ
            </div>
          </div>

          {/* Vietnamese currency word readout */}
          {numVal !== null && numVal > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50/80 px-3 py-1.5 rounded-lg border border-blue-200/50">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-500" />
              <span>Bằng chữ: <strong>{formatVietnameseCurrencyText(numVal)}</strong></span>
            </div>
          )}

          {/* Quick Amount Suggestion Pills */}
          <div className="pt-0.5">
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              Gợi ý số tiền nhanh:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPills.map((pillVal) => (
                <button
                  key={pillVal}
                  type="button"
                  onClick={() => onChange(question.code, pillVal)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                    numVal === pillVal
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-700'
                  }`}
                >
                  {formatShortMoney(pillVal)}
                </button>
              ))}
            </div>
          </div>

          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng nhập số tiền hợp lệ</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 5. NUMBER: Numeric Input
    // --------------------------------------------------------
    case 'NUMBER': {
      const numVal = value !== null && value !== undefined ? String(value) : '';

      return (
        <div className="space-y-1.5">
          <input
            type="number"
            inputMode="numeric"
            value={numVal}
            min={cfg.min}
            max={cfg.max}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value);
              onChange(question.code, val);
            }}
            placeholder="Nhập số lượng hoặc giá trị..."
            className={`w-full h-12 sm:h-13 px-4 bg-white border rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all ${
              hasError ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-100' : 'border-slate-200'
            }`}
          />
          {cfg.min !== undefined && cfg.max !== undefined && (
            <p className="text-[11px] text-slate-400">
              Giới hạn từ {cfg.min} đến {cfg.max}
            </p>
          )}
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng nhập giá trị số</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 6. TEXT: Single Line Input
    // --------------------------------------------------------
    case 'TEXT': {
      const textVal = typeof value === 'string' ? value : '';

      return (
        <div className="space-y-1.5">
          <input
            type="text"
            value={textVal}
            maxLength={cfg.maxLength}
            onChange={(e) => onChange(question.code, e.target.value)}
            placeholder="Nhập câu trả lời của bạn..."
            className={`w-full h-12 sm:h-13 px-4 bg-white border rounded-xl text-sm sm:text-base text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400 ${
              hasError ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-100' : 'border-slate-200'
            }`}
          />
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng điền thông tin này</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 7. LONG_TEXT: Multi-line Textarea
    // --------------------------------------------------------
    case 'LONG_TEXT': {
      const textVal = typeof value === 'string' ? value : '';

      return (
        <div className="space-y-1.5">
          <textarea
            rows={3}
            value={textVal}
            maxLength={cfg.maxLength}
            onChange={(e) => onChange(question.code, e.target.value)}
            placeholder="Nhập chi tiết nhu cầu hoặc ghi chú thêm của bạn..."
            className={`w-full p-4 bg-white border rounded-xl text-sm sm:text-base text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400 ${
              hasError ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-100' : 'border-slate-200'
            }`}
          />
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng điền thông tin chi tiết</span>
            </p>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // 8. DATE: Date Picker Input
    // --------------------------------------------------------
    case 'DATE': {
      const dateVal = typeof value === 'string' ? value : '';

      return (
        <div className="space-y-1.5">
          <input
            type="date"
            value={dateVal}
            min={cfg.minDate}
            max={cfg.maxDate}
            onChange={(e) => onChange(question.code, e.target.value)}
            className={`w-full h-12 sm:h-13 px-4 bg-white border rounded-xl text-sm sm:text-base text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all ${
              hasError ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-100' : 'border-slate-200'
            }`}
          />
          {hasError && (
            <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Vui lòng chọn ngày hợp lệ</span>
            </p>
          )}
        </div>
      );
    }

    default:
      return (
        <p className="text-xs text-slate-400 italic">
          Loại câu hỏi này không có sẵn hiển thị.
        </p>
      );
  }
};

// ============================================================
// Main Survey Page Component
// ============================================================
export const SurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  // States
  const [status, setStatus] = useState<SurveyStatus>('loading');
  const [surveyData, setSurveyData] = useState<PublicSurveyData | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Refs for autosave debounce
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Switch entire page background to clean slate-50 light mode
  useEffect(() => {
    const originalBodyClass = document.body.className;
    document.body.classList.remove('bg-slate-950', 'text-slate-100');
    document.body.classList.add('bg-slate-50', 'text-slate-900');

    return () => {
      document.body.className = originalBodyClass;
    };
  }, []);

  // Fetch Survey on Mount
  useEffect(() => {
    if (!token) {
      setErrorMsg('Đường link không hợp lệ.');
      setStatus('error');
      return;
    }

    publicSurveyPublicApi
      .getSurveyData(token)
      .then((data) => {
        setSurveyData(data);

        // Restore any previously saved answers
        const restored: AnswerMap = {};
        for (const a of data.savedAnswers || []) {
          restored[a.questionCode] = a.answerValue;
        }
        setAnswers(restored);

        if (data.status === 'COMPLETED') setStatus('completed');
        else if (data.status === 'EXPIRED') setStatus('expired');
        else if (data.status === 'REVOKED') setStatus('revoked');
        else setStatus('intro');
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Không thể tải thông tin khảo sát.');
        setStatus('error');
      });
  }, [token]);

  // Debounced Auto-save
  const triggerAutoSave = useCallback(
    (currentAnswers: AnswerMap) => {
      if (!token) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      setSaveStatus('saving');
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          isSavingRef.current = true;
          const entries = Object.entries(currentAnswers)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([code, val]) => ({ questionCode: code, answerValue: val }));

          if (entries.length > 0) {
            await publicSurveyPublicApi.saveAnswers(token, entries);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2500);
          } else {
            setSaveStatus('idle');
          }
        } catch {
          setSaveStatus('error');
        } finally {
          isSavingRef.current = false;
        }
      }, 1200);
    },
    [token]
  );

  // Manual save handler
  const handleManualSave = async () => {
    if (!token) return;
    setSaveStatus('saving');
    try {
      const entries = Object.entries(answers)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([code, val]) => ({ questionCode: code, answerValue: val }));

      if (entries.length > 0) {
        await publicSurveyPublicApi.saveAnswers(token, entries);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('idle');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const handleAnswerChange = (code: string, val: AnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [code]: val };
      triggerAutoSave(next);
      return next;
    });
    if (showErrors) setShowErrors(false);
  };

  // Compute visible questions (respecting conditional dependencies)
  const visibleQuestions = useMemo(() => {
    if (!surveyData) return [];
    return getVisibleQuestions(surveyData.questions, answers);
  }, [surveyData, answers]);

  // Total answers completed
  const answeredCount = useMemo(() => {
    return visibleQuestions.filter((q) => {
      const val = answers[q.code];
      return (
        val !== null &&
        val !== undefined &&
        val !== '' &&
        !(Array.isArray(val) && val.length === 0)
      );
    }).length;
  }, [visibleQuestions, answers]);

  const totalVisibleCount = visibleQuestions.length;
  const progressPercent =
    totalVisibleCount > 0 ? Math.round((answeredCount / totalVisibleCount) * 100) : 0;

  // Split visible questions into steps
  const totalSteps = Math.max(1, Math.ceil(totalVisibleCount / QUESTIONS_PER_STEP));
  const currentStepClamped = Math.min(currentStepIndex, totalSteps - 1);

  const currentStepQuestions = useMemo(() => {
    const start = currentStepClamped * QUESTIONS_PER_STEP;
    return visibleQuestions.slice(start, start + QUESTIONS_PER_STEP);
  }, [visibleQuestions, currentStepClamped]);

  const isLastStep = currentStepClamped === totalSteps - 1;

  // Validate current step questions
  const validateCurrentStep = (): boolean => {
    const missingInCurrentStep = currentStepQuestions.filter((q) => {
      if (!q.isRequired) return false;
      const v = answers[q.code];
      return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    });

    if (missingInCurrentStep.length > 0) {
      setShowErrors(true);
      const firstMissingId = `q-card-${missingInCurrentStep[0].code}`;
      document.getElementById(firstMissingId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    setShowErrors(false);
    return true;
  };

  // Next step click
  const handleNextStep = () => {
    if (!validateCurrentStep()) return;
    setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Previous step click
  const handlePrevStep = () => {
    setShowErrors(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Submit
  const handleSubmit = async () => {
    if (!token || !surveyData) return;

    // Validate ALL visible required questions across all steps
    const allMissing = visibleQuestions.filter((q) => {
      if (!q.isRequired) return false;
      const v = answers[q.code];
      return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    });

    if (allMissing.length > 0) {
      setShowErrors(true);
      // Find which step contains the first missing question and switch to it
      const firstMissingCode = allMissing[0].code;
      const missingIndex = visibleQuestions.findIndex((q) => q.code === firstMissingCode);
      if (missingIndex !== -1) {
        const targetStep = Math.floor(missingIndex / QUESTIONS_PER_STEP);
        setCurrentStepIndex(targetStep);
      }
      setTimeout(() => {
        document.getElementById(`q-card-${firstMissingCode}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return;
    }

    setStatus('submitting');
    try {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const finalAnswers = Object.entries(answers)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([code, val]) => ({ questionCode: code, answerValue: val }));

      await publicSurveyPublicApi.complete(token, finalAnswers);
      setStatus('completed');
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể gửi bài khảo sát. Vui lòng kiểm tra lại.');
      setStatus('filling');
    }
  };

  // ==========================================================
  // 1. STATE: LOADING
  // ==========================================================
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Đang tải bảng khảo sát...</h2>
          <p className="text-xs text-slate-500">Vui lòng đợi giây lát trong khi chúng tôi chuẩn bị câu hỏi.</p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // 2. STATE: COMPLETED
  // ==========================================================
  if (status === 'completed') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-lg shadow-slate-200/50 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Gửi khảo sát thành công!
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Cảm ơn Quý khách đã dành thời gian cung cấp thông tin. Hệ thống KTEA đã ghi nhận
              toàn bộ câu trả lời để phân tích và chuẩn bị giải pháp tài chính tốt nhất.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 text-left space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Bước tiếp theo:</span>
            </div>
            <p className="leading-relaxed">
              Chuyên viên tư vấn tài chính KTEA sẽ liên hệ trực tiếp với Quý khách qua số điện
              thoại đăng ký trong thời gian sớm nhất để hỗ trợ chi tiết.
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Quý khách có thể đóng tab trình duyệt này một cách an toàn.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // 3. STATE: EXPIRED
  // ==========================================================
  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-amber-200/80 p-8 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Link khảo sát đã hết hạn</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Vì lý do bảo mật thông tin, đường link khảo sát có thời hạn sử dụng 7 ngày và hiện đã
              hết hạn.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-800 text-left">
            Quý khách vui lòng liên hệ nhân viên tư vấn KTEA để được cấp đường link khảo sát mới.
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // 4. STATE: REVOKED
  // ==========================================================
  if (status === 'revoked') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200/80 p-8 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
            <X className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Link khảo sát đã bị thu hồi</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Đường link này không còn hiệu lực do đã được cập nhật hoặc thay thế bởi hệ thống.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            Vui lòng liên hệ với chuyên viên KTEA để nhận thông tin hỗ trợ mới nhất.
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // 5. STATE: ERROR
  // ==========================================================
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">Không thể mở bài khảo sát</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {errorMsg || 'Đường dẫn không tồn tại hoặc đã xảy ra lỗi kết nối.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử tải lại</span>
          </button>
        </div>
      </div>
    );
  }

  if (!surveyData) return null;

  // ==========================================================
  // 6. STATE: INTRO SCREEN
  // ==========================================================
  if (status === 'intro') {
    const surveyTitle =
      surveyData.questionnaire.versionTitle ||
      surveyData.questionnaire.title ||
      'Khảo sát nhu cầu tài chính';
    const hasPreviousAnswers = surveyData.savedAnswers.length > 0;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xl shadow-slate-200/40 space-y-6 sm:space-y-8">
          {/* Header Brand */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-bold text-lg tracking-wider">
                KT
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">KTEA FINTECH CRM</h3>
                <p className="text-[11px] text-slate-400 font-medium">Hệ thống khảo sát tài chính</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Bảo mật 100%</span>
            </span>
          </div>

          {/* Survey Title & Purpose */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {surveyTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {surveyData.questionnaire.description ||
                'Vui lòng cung cấp một số thông tin cơ bản về nhu cầu và điều kiện tài chính để chúng tôi tư vấn gói sản phẩm phù hợp nhất với Quý khách.'}
            </p>
          </div>

          {/* Stats Meta Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="flex items-center gap-3 p-2">
              <div className="w-9 h-9 rounded-xl bg-white text-blue-600 border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Quy mô khảo sát</span>
                <span className="text-sm font-bold text-slate-800">{totalVisibleCount} câu hỏi</span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2">
              <div className="w-9 h-9 rounded-xl bg-white text-emerald-600 border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Thời gian ước tính</span>
                <span className="text-sm font-bold text-slate-800">~{Math.max(3, Math.ceil(totalVisibleCount * 0.4))} phút</span>
              </div>
            </div>
          </div>

          {/* Resume notification if previous answers exist */}
          {hasPreviousAnswers && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-emerald-950">
                  Đã khôi phục tiến trình làm bài trước đó
                </span>
                <span>
                  Bạn đã trả lời {surveyData.savedAnswers.length} câu hỏi. Bạn có thể tiếp tục
                  hoàn tất mà không cần nhập lại từ đầu.
                </span>
              </div>
            </div>
          )}

          {/* Trust and Privacy Note */}
          <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-4">
            🔒 <strong>Cam kết bảo mật:</strong> Thông tin của Quý khách được mã hóa chuẩn an toàn
            và chỉ phục vụ mục đích thẩm định, tư vấn gói tài chính phù hợp từ ngân hàng đối tác.
          </div>

          {/* Start CTA Button */}
          <button
            type="button"
            onClick={() => setStatus('filling')}
            className="w-full h-13 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base rounded-2xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <span>{hasPreviousAnswers ? 'Tiếp tục làm bài' : 'Bắt đầu khảo sát'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================
  // 7. STATE: FILLING / MAIN MULTI-STEP SURVEY
  // ==========================================================
  const surveyTitle =
    surveyData.questionnaire.versionTitle ||
    surveyData.questionnaire.title ||
    'Khảo sát nhu cầu tài chính';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* ================= STICKY HEADER ================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              KT
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {surveyTitle}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Bước {currentStepClamped + 1} / {totalSteps} • Đã trả lời {answeredCount}/{totalVisibleCount} câu
              </p>
            </div>
          </div>

          {/* Auto-save status indicator */}
          <div className="shrink-0 flex items-center">
            {saveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                <span className="hidden sm:inline">Đang lưu...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                <span className="hidden sm:inline">Đã lưu tự động</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={handleManualSave}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
              >
                <AlertCircle className="w-3 h-3 text-rose-600" />
                <span>Thử lưu lại</span>
              </button>
            )}
            {saveStatus === 'idle' && (
              <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Tự động lưu</span>
              </span>
            )}
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-slate-100 h-1 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-2xl mx-auto px-4 pt-6 sm:pt-8 space-y-6">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span className="uppercase tracking-wider text-blue-600 font-bold">
            Phần {currentStepClamped + 1} / {totalSteps}
          </span>
          <span className="text-slate-500">
            Tiến độ hoàn thành: <strong className="text-slate-800">{progressPercent}%</strong>
          </span>
        </div>

        {/* Error Banner if missing required questions */}
        {showErrors && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Vui lòng hoàn thành các câu hỏi bắt buộc:</span>
              <span>Các câu hỏi có dấu hoa thị màu đỏ (*) là bắt buộc trước khi chuyển tiếp.</span>
            </div>
          </div>
        )}

        {/* ================= QUESTIONS LIST FOR CURRENT STEP ================= */}
        <div className="space-y-5">
          {currentStepQuestions.map((q) => {
            // Calculate absolute 1-indexed number among all visible questions
            const absoluteIndex = visibleQuestions.findIndex((item) => item.code === q.code) + 1;
            const isEmpty =
              answers[q.code] === null ||
              answers[q.code] === undefined ||
              answers[q.code] === '' ||
              (Array.isArray(answers[q.code]) && (answers[q.code] as string[]).length === 0);
            const isQuestionError = showErrors && q.isRequired && isEmpty;

            return (
              <div
                key={q.code}
                id={`q-card-${q.code}`}
                className={`bg-white rounded-2xl border transition-all p-5 sm:p-7 space-y-4 shadow-xs ${
                  isQuestionError
                    ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/10'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Question Title & Description */}
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {absoluteIndex}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {q.questionText}
                      {q.isRequired && <span className="text-rose-500 font-bold ml-1">*</span>}
                    </h3>
                  </div>
                  {q.description && (
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed pl-8.5">
                      {q.description}
                    </p>
                  )}
                </div>

                {/* Question Input Controls */}
                <div className="pt-2 pl-0 sm:pl-8.5">
                  <QuestionRenderer
                    question={q}
                    value={answers[q.code] ?? null}
                    onChange={handleAnswerChange}
                    showError={showErrors}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ================= NAVIGATION FOOTER BAR ================= */}
        <div className="pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Back & Manual Save Buttons */}
          <div className="flex items-center gap-2.5">
            {currentStepClamped > 0 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 sm:flex-none h-12 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.99]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualSave}
              className="flex-1 sm:flex-none h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 active:scale-[0.99]"
              title="Lưu tạm dữ liệu hiện tại để tiếp tục sau"
            >
              <Save className="w-4 h-4 text-blue-600" />
              <span>Lưu tạm</span>
            </button>
          </div>

          {/* Next / Submit Button */}
          {isLastStep ? (
            <button
              type="button"
              disabled={status === 'submitting'}
              onClick={handleSubmit}
              className="h-13 sm:h-14 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-base font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang gửi khảo sát...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Gửi khảo sát hoàn tất</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextStep}
              className="h-13 sm:h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Security & Disclaimer Footer */}
        <div className="text-center pt-8 pb-4 text-xs text-slate-400 space-y-1">
          <p>KTEA CRM • Hệ thống quản lý & phân tích nhu cầu tài chính cá nhân</p>
          <p className="text-[11px]">Thông tin của Quý khách được bảo vệ an toàn theo chính sách bảo mật thông tin.</p>
        </div>
      </main>
    </div>
  );
};

export default SurveyPage;
