/**
 * SurveyPage.tsx
 * Public-facing survey page for customer self-service questionnaire.
 * Route: /survey/:token  (NO login guard — public access)
 *
 * Design: Fintech modern, mobile-first, Vietnamese language.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicSurveyPublicApi, PublicSurveyData, SurveyQuestion } from '../services/publicSurveyService';

// ============================================================
// Types
// ============================================================
type SurveyStatus = 'loading' | 'intro' | 'filling' | 'saving' | 'submitting' | 'completed' | 'expired' | 'revoked' | 'error';

type AnswerValue = string | number | boolean | string[] | null;

interface AnswerMap {
  [questionCode: string]: AnswerValue;
}

// ============================================================
// Conditional logic evaluator (mirrors backend)
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
    case 'EQUALS': return String(scalar ?? '') === String(value ?? '');
    case 'NOT_EQUALS': return String(scalar ?? '') !== String(value ?? '');
    case 'IN': return Array.isArray(value) && value.some((v) => String(v) === String(scalar ?? ''));
    case 'NOT_IN': return Array.isArray(value) && !value.some((v) => String(v) === String(scalar ?? ''));
    case 'GREATER_THAN': return Number(scalar ?? 0) > Number(value ?? 0);
    case 'LESS_THAN': return Number(scalar ?? 0) < Number(value ?? 0);
    case 'IS_EMPTY': return scalar === undefined || scalar === null || scalar === '' || (Array.isArray(scalar) && scalar.length === 0);
    case 'IS_NOT_EMPTY': return scalar !== undefined && scalar !== null && scalar !== '' && (!Array.isArray(scalar) || scalar.length > 0);
    default: return true;
  }
}

function getVisibleQuestions(questions: SurveyQuestion[], answers: AnswerMap): SurveyQuestion[] {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

// ============================================================
// Question Renderer
// ============================================================
function QuestionRenderer({
  question,
  value,
  onChange,
  showError,
}: {
  question: SurveyQuestion;
  value: AnswerValue;
  onChange: (code: string, val: AnswerValue) => void;
  showError: boolean;
}) {
  const cfg = question.validationConfig || {};
  const isEmpty =
    value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0);
  const hasError = showError && question.isRequired && isEmpty;

  const inputCls = `survey-input ${hasError ? 'error' : ''}`;

  switch (question.questionType) {
    case 'SINGLE_CHOICE': {
      const opts = question.options || [];
      const selected = typeof value === 'string' ? value : '';
      return (
        <div className="choice-grid">
          {opts.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`choice-btn ${selected === opt.value ? 'selected' : ''}`}
              onClick={() => onChange(question.code, opt.value)}
            >
              <span className="choice-radio">{selected === opt.value ? '●' : '○'}</span>
              {opt.label}
            </button>
          ))}
          {hasError && <span className="field-error">Vui lòng chọn một đáp án</span>}
        </div>
      );
    }

    case 'MULTIPLE_CHOICE': {
      const opts = question.options || [];
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (v: string) => {
        const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
        onChange(question.code, next);
      };
      return (
        <div className="choice-grid">
          {opts.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`choice-btn ${selected.includes(opt.value) ? 'selected' : ''}`}
              onClick={() => toggle(opt.value)}
            >
              <span className="choice-check">{selected.includes(opt.value) ? '☑' : '☐'}</span>
              {opt.label}
            </button>
          ))}
          {hasError && <span className="field-error">Vui lòng chọn ít nhất một đáp án</span>}
        </div>
      );
    }

    case 'YES_NO': {
      const boolVal = value === true || value === 'YES';
      const noVal = value === false || value === 'NO';
      return (
        <div className="yesno-group">
          <button
            type="button"
            className={`yesno-btn yes ${boolVal ? 'selected' : ''}`}
            onClick={() => onChange(question.code, true)}
          >
            ✓ Có
          </button>
          <button
            type="button"
            className={`yesno-btn no ${noVal ? 'selected' : ''}`}
            onClick={() => onChange(question.code, false)}
          >
            ✗ Không
          </button>
          {hasError && <span className="field-error">Vui lòng chọn Có hoặc Không</span>}
        </div>
      );
    }

    case 'NUMBER': {
      return (
        <div>
          <input
            className={inputCls}
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            min={cfg.min}
            max={cfg.max}
            onChange={(e) => onChange(question.code, e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Nhập số..."
          />
          {hasError && <span className="field-error">Câu hỏi bắt buộc</span>}
        </div>
      );
    }

    case 'CURRENCY': {
      const numVal = value !== null && value !== undefined ? String(value) : '';
      return (
        <div>
          <div className="currency-wrap">
            <span className="currency-prefix">₫</span>
            <input
              className={`${inputCls} currency-input`}
              type="number"
              value={numVal}
              min={cfg.min ?? 0}
              max={cfg.max}
              onChange={(e) => onChange(question.code, e.target.value === '' ? null : Number(e.target.value))}
              placeholder="0"
            />
          </div>
          {hasError && <span className="field-error">Câu hỏi bắt buộc</span>}
        </div>
      );
    }

    case 'TEXT': {
      return (
        <div>
          <input
            className={inputCls}
            type="text"
            value={typeof value === 'string' ? value : ''}
            maxLength={cfg.maxLength}
            onChange={(e) => onChange(question.code, e.target.value)}
            placeholder="Nhập câu trả lời..."
          />
          {hasError && <span className="field-error">Câu hỏi bắt buộc</span>}
        </div>
      );
    }

    case 'LONG_TEXT': {
      return (
        <div>
          <textarea
            className={inputCls}
            rows={4}
            value={typeof value === 'string' ? value : ''}
            maxLength={cfg.maxLength}
            onChange={(e) => onChange(question.code, e.target.value)}
            placeholder="Nhập câu trả lời chi tiết..."
          />
          {hasError && <span className="field-error">Câu hỏi bắt buộc</span>}
        </div>
      );
    }

    case 'DATE': {
      return (
        <div>
          <input
            className={inputCls}
            type="date"
            value={typeof value === 'string' ? value : ''}
            min={cfg.minDate}
            max={cfg.maxDate}
            onChange={(e) => onChange(question.code, e.target.value)}
          />
          {hasError && <span className="field-error">Câu hỏi bắt buộc</span>}
        </div>
      );
    }

    default:
      return <p style={{ color: '#888' }}>Loại câu hỏi này chưa được hỗ trợ hiển thị.</p>;
  }
}

// ============================================================
// Main Survey Page
// ============================================================
export const SurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<SurveyStatus>('loading');
  const [surveyData, setSurveyData] = useState<PublicSurveyData | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [showErrors, setShowErrors] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef(false);

  // Load survey on mount
  useEffect(() => {
    if (!token) {
      setErrorMsg('Link không hợp lệ');
      setStatus('error');
      return;
    }

    publicSurveyPublicApi
      .getSurveyData(token)
      .then((data) => {
        setSurveyData(data);
        // Restore saved answers
        const restored: AnswerMap = {};
        for (const a of data.savedAnswers) {
          restored[a.questionCode] = a.answerValue;
        }
        setAnswers(restored);

        if (data.status === 'COMPLETED') setStatus('completed');
        else if (data.status === 'EXPIRED') setStatus('expired');
        else if (data.status === 'REVOKED') setStatus('revoked');
        else setStatus('intro');
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Không thể tải khảo sát');
        setStatus('error');
      });
  }, [token]);

  // Debounced auto-save
  const triggerAutoSave = useCallback(
    (currentAnswers: AnswerMap) => {
      if (!token) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      pendingSave.current = true;
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const entries = Object.entries(currentAnswers)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([code, val]) => ({ questionCode: code, answerValue: val }));
          if (entries.length === 0) return;
          await publicSurveyPublicApi.saveAnswers(token, entries);
          setSaveMsg('Đã lưu tự động ✓');
          pendingSave.current = false;
          setTimeout(() => setSaveMsg(''), 2000);
        } catch {
          setSaveMsg('Lưu thất bại, thử lại sau...');
        }
      }, 1500);
    },
    [token]
  );

  const handleAnswerChange = (code: string, val: AnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [code]: val };
      triggerAutoSave(next);
      return next;
    });
    if (showErrors) setShowErrors(false);
  };

  const handleSubmit = async () => {
    if (!token || !surveyData) return;

    // Validate visible required questions
    const visible = getVisibleQuestions(surveyData.questions, answers);
    const missing = visible.filter((q) => {
      if (!q.isRequired) return false;
      const v = answers[q.code];
      return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    });

    if (missing.length > 0) {
      setShowErrors(true);
      // Scroll to first unanswered question
      document.getElementById(`q-${missing[0].code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setStatus('submitting');
    try {
      // Wait for any pending save to be overridden by submit
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const finalAnswers = Object.entries(answers)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([code, val]) => ({ questionCode: code, answerValue: val }));

      await publicSurveyPublicApi.complete(token, finalAnswers);
      setStatus('completed');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gửi khảo sát thất bại. Vui lòng thử lại.');
      setStatus('filling');
    }
  };

  // ========== Render states ==========

  if (status === 'loading') {
    return (
      <div className="survey-shell">
        <div className="survey-card survey-loading">
          <div className="spinner" />
          <p>Đang tải khảo sát...</p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="survey-shell">
        <div className="survey-card survey-status-card">
          <div className="status-icon expired-icon">⏰</div>
          <h2>Link đã hết hạn</h2>
          <p>Link khảo sát này đã hết hạn. Vui lòng liên hệ nhân viên KTEA để nhận link mới.</p>
        </div>
      </div>
    );
  }

  if (status === 'revoked') {
    return (
      <div className="survey-shell">
        <div className="survey-card survey-status-card">
          <div className="status-icon revoked-icon">🚫</div>
          <h2>Link đã bị thu hồi</h2>
          <p>Link khảo sát này không còn hiệu lực. Vui lòng liên hệ nhân viên KTEA để được hỗ trợ.</p>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="survey-shell">
        <div className="survey-card survey-status-card completed-card">
          <div className="status-icon completed-icon">✅</div>
          <h2>Cảm ơn bạn đã hoàn thành khảo sát!</h2>
          <p>
            Câu trả lời của bạn đã được ghi nhận thành công. Chuyên viên tư vấn KTEA sẽ liên hệ
            với bạn sớm nhất có thể.
          </p>
          <div className="completed-note">
            <strong>Lưu ý:</strong> Bạn không cần thực hiện thêm bất kỳ thao tác nào.
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="survey-shell">
        <div className="survey-card survey-status-card">
          <div className="status-icon error-icon">⚠️</div>
          <h2>Không thể tải khảo sát</h2>
          <p>{errorMsg || 'Link không hợp lệ hoặc đã hết hạn.'}</p>
        </div>
      </div>
    );
  }

  if (!surveyData) return null;

  const visible = getVisibleQuestions(surveyData.questions, answers);
  const totalVisible = visible.length;
  const answeredCount = visible.filter((q) => {
    const v = answers[q.code];
    return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const progress = totalVisible > 0 ? Math.round((answeredCount / totalVisible) * 100) : 0;

  // Intro screen
  if (status === 'intro') {
    return (
      <div className="survey-shell">
        <div className="survey-card intro-card">
          <div className="ktea-logo-bar">
            <span className="ktea-logo-text">KTEA</span>
            <span className="ktea-tagline">Khảo sát nhu cầu</span>
          </div>
          <h1 className="survey-title">{surveyData.questionnaire.versionTitle}</h1>
          {surveyData.questionnaire.description && (
            <p className="survey-desc">{surveyData.questionnaire.description}</p>
          )}
          <div className="survey-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Số câu hỏi</span>
              <span className="meta-value">{totalVisible}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Thời gian dự kiến</span>
              <span className="meta-value">~{Math.max(3, Math.ceil(totalVisible * 0.5))} phút</span>
            </div>
          </div>
          {surveyData.savedAnswers.length > 0 && (
            <div className="resume-notice">
              💾 Bạn đã lưu {surveyData.savedAnswers.length} câu trả lời trước đó.
              Bạn có thể tiếp tục từ chỗ đã lưu.
            </div>
          )}
          <div className="intro-note">
            Thông tin bạn cung cấp sẽ được sử dụng để tư vấn các sản phẩm tài chính phù hợp nhất.
          </div>
          <button
            className="survey-btn-primary survey-btn-large"
            onClick={() => setStatus('filling')}
          >
            {surveyData.savedAnswers.length > 0 ? 'Tiếp tục khảo sát →' : 'Bắt đầu khảo sát →'}
          </button>
        </div>
      </div>
    );
  }

  // Main survey form
  return (
    <div className="survey-shell">
      {/* Header */}
      <div className="survey-header">
        <div className="survey-header-content">
          <span className="ktea-logo-text-sm">KTEA</span>
          <span className="survey-header-title">{surveyData.questionnaire.versionTitle}</span>
        </div>
        <div className="progress-info">
          {answeredCount}/{totalVisible} câu
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Save indicator */}
      {saveMsg && (
        <div className="save-toast">{saveMsg}</div>
      )}

      {/* Questions */}
      <div className="survey-form">
        {visible.map((q, idx) => (
          <div
            key={q.code}
            id={`q-${q.code}`}
            className="question-card"
          >
            <div className="question-header">
              <span className="question-num">{idx + 1}</span>
              <div className="question-body">
                <p className="question-text">
                  {q.questionText}
                  {q.isRequired && <span className="required-star"> *</span>}
                </p>
                {q.description && <p className="question-desc">{q.description}</p>}
              </div>
            </div>
            <div className="question-answer-area">
              <QuestionRenderer
                question={q}
                value={answers[q.code] ?? null}
                onChange={handleAnswerChange}
                showError={showErrors}
              />
            </div>
          </div>
        ))}

        {/* Error summary */}
        {showErrors && (
          <div className="error-banner">
            ⚠️ Vui lòng trả lời tất cả câu hỏi bắt buộc trước khi gửi.
          </div>
        )}

        {/* Submit area */}
        <div className="submit-area">
          <button
            className="survey-btn-primary survey-btn-large"
            disabled={status === 'submitting'}
            onClick={handleSubmit}
          >
            {status === 'submitting' ? (
              <><span className="btn-spinner" /> Đang gửi...</>
            ) : (
              'Gửi khảo sát ✓'
            )}
          </button>
          <p className="submit-note">
            Bấm "Gửi khảo sát" để hoàn tất. Câu trả lời của bạn sẽ được lưu lại.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SurveyPage;
