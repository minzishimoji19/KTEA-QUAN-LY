/**
 * AkinatorQuestionEditorModal.tsx
 *
 * Modal for creating and editing questions in a Draft Akinator Configuration.
 * Supports:
 * - Basic metadata, Question types, Entry question flag, Evaluation required flag
 * - Options builder for SINGLE_CHOICE and MULTIPLE_CHOICE
 * - Validation configuration (min, max, minLength, maxLength)
 * - Mapping to customer CRM fields
 * - Visibility Conditions (logic AND/OR + condition items)
 * - Next Question Branching Rules (GOTO_QUESTION / END_QUIZ)
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  GitBranch,
  Eye,
  Sliders,
  Check,
} from 'lucide-react';
import {
  AkinatorQuestionItem,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorQuestionOption,
  AkinatorConditionOperator,
  AkinatorSingleCondition,
  AkinatorNextQuestionRule,
} from '../../types/akinator';

interface Props {
  isOpen: boolean;
  question: AkinatorQuestionItem | null;
  existingQuestions: AkinatorQuestionItem[];
  onClose: () => void;
  onSave: (savedQuestion: AkinatorQuestionItem) => void;
}

const QUESTION_TYPES: Array<{ value: AkinatorQuestionType; label: string }> = [
  { value: 'SINGLE_CHOICE', label: 'Một lựa chọn (Radio)' },
  { value: 'MULTIPLE_CHOICE', label: 'Nhiều lựa chọn (Checkbox)' },
  { value: 'YES_NO', label: 'Có / Không (Yes-No)' },
  { value: 'CURRENCY', label: 'Số tiền (VND)' },
  { value: 'NUMBER', label: 'Số nguyên / Định lượng' },
  { value: 'TEXT', label: 'Văn bản (Text)' },
  { value: 'DATE', label: 'Ngày tháng (Date dd/MM/yyyy)' },
];

const CUSTOMER_FIELD_MAPPINGS: Array<{ value: AkinatorCustomerFieldMapping; label: string }> = [
  { value: 'NONE', label: 'Không ánh xạ (câu hỏi nghiệp vụ thông thường)' },
  { value: 'FULL_NAME', label: 'Họ và tên khách hàng (FULL_NAME)' },
  { value: 'PHONE', label: 'Số điện thoại liên hệ (PHONE)' },
  { value: 'EMAIL', label: 'Email liên hệ (EMAIL)' },
  { value: 'DOB', label: 'Ngày sinh (DOB)' },
  { value: 'GENDER', label: 'Giới tính (GENDER)' },
  { value: 'ADDRESS', label: 'Địa chỉ nơi ở / kinh doanh (ADDRESS)' },
];

const CONDITION_OPERATORS: Array<{ value: AkinatorConditionOperator; label: string }> = [
  { value: 'EQUALS', label: 'Bằng (=)' },
  { value: 'NOT_EQUALS', label: 'Khác (!=)' },
  { value: 'IN', label: 'Thuộc danh sách (IN)' },
  { value: 'NOT_IN', label: 'Không thuộc danh sách (NOT IN)' },
  { value: 'GT', label: 'Lớn hơn (>)' },
  { value: 'GTE', label: 'Lớn hơn hoặc bằng (>=)' },
  { value: 'LT', label: 'Nhỏ hơn (<)' },
  { value: 'LTE', label: 'Nhỏ hơn hoặc bằng (<=)' },
  { value: 'CONTAINS', label: 'Chứa chuỗi (CONTAINS)' },
  { value: 'IS_ANSWERED', label: 'Đã được trả lời' },
  { value: 'IS_NOT_ANSWERED', label: 'Chưa được trả lời' },
];

export const AkinatorQuestionEditorModal: React.FC<Props> = ({
  isOpen,
  question,
  existingQuestions,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'options' | 'visibility' | 'branching'>('basic');
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState<string>('');
  const [questionText, setQuestionText] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [questionType, setQuestionType] = useState<AkinatorQuestionType>('SINGLE_CHOICE');
  const [isEntryQuestion, setIsEntryQuestion] = useState<boolean>(false);
  const [isRequiredForEval, setIsRequiredForEval] = useState<boolean>(true);
  const [priorityWeight, setPriorityWeight] = useState<number>(50);
  const [mapsToCustomerField, setMapsToCustomerField] = useState<AkinatorCustomerFieldMapping>('NONE');

  // Options
  const [options, setOptions] = useState<AkinatorQuestionOption[]>([]);

  // Validation config
  const [valMin, setValMin] = useState<string>('');
  const [valMax, setValMax] = useState<string>('');
  const [valMinLength, setValMinLength] = useState<string>('');
  const [valMaxLength, setValMaxLength] = useState<string>('');

  // Visibility conditions
  const [hasVisibility, setHasVisibility] = useState<boolean>(false);
  const [visibilityLogic, setVisibilityLogic] = useState<'AND' | 'OR'>('AND');
  const [visibilityItems, setVisibilityItems] = useState<AkinatorSingleCondition[]>([]);

  // Next question branching rules
  const [nextRules, setNextRules] = useState<AkinatorNextQuestionRule[]>([]);

  useEffect(() => {
    if (question) {
      setCode(question.code || '');
      setQuestionText(question.questionText || '');
      setDescription(question.description || '');
      setQuestionType(question.questionType || 'SINGLE_CHOICE');
      setIsEntryQuestion(Boolean(question.isEntryQuestion));
      setIsRequiredForEval(question.isRequiredForEval !== undefined ? Boolean(question.isRequiredForEval) : true);
      setPriorityWeight(question.priorityWeight ?? 50);
      setMapsToCustomerField(question.mapsToCustomerField || 'NONE');

      setOptions(question.options ? [...question.options] : []);

      const vc = question.validationConfig || {};
      setValMin(vc.min !== undefined ? String(vc.min) : '');
      setValMax(vc.max !== undefined ? String(vc.max) : '');
      setValMinLength(vc.minLength !== undefined ? String(vc.minLength) : '');
      setValMaxLength(vc.maxLength !== undefined ? String(vc.maxLength) : '');

      if (question.visibilityConditions && question.visibilityConditions.conditions?.length > 0) {
        setHasVisibility(true);
        setVisibilityLogic(question.visibilityConditions.logic || 'AND');
        setVisibilityItems(question.visibilityConditions.conditions.map((c) => ({ ...c })));
      } else {
        setHasVisibility(false);
        setVisibilityLogic('AND');
        setVisibilityItems([]);
      }

      setNextRules(question.nextQuestionRules ? question.nextQuestionRules.map((r) => ({ ...r })) : []);
    } else {
      // Defaults for new question
      setCode('');
      setQuestionText('');
      setDescription('');
      setQuestionType('SINGLE_CHOICE');
      setIsEntryQuestion(existingQuestions.length === 0);
      setIsRequiredForEval(true);
      setPriorityWeight(50);
      setMapsToCustomerField('NONE');
      setOptions([
        { value: 'OPTION_1', label: 'Lựa chọn 1' },
        { value: 'OPTION_2', label: 'Lựa chọn 2' },
      ]);
      setValMin('');
      setValMax('');
      setValMinLength('');
      setValMaxLength('');
      setHasVisibility(false);
      setVisibilityLogic('AND');
      setVisibilityItems([]);
      setNextRules([]);
    }
    setActiveTab('basic');
    setError(null);
  }, [question, existingQuestions, isOpen]);

  if (!isOpen) return null;

  // Other available questions for conditions/branching (excluding current question)
  const otherQuestions = existingQuestions.filter((q) => q.code !== code);

  // Handlers for Options
  const handleAddOption = () => {
    const nextIdx = options.length + 1;
    setOptions([
      ...options,
      { value: `OPT_${nextIdx}`, label: `Phương án ${nextIdx}`, description: '' },
    ]);
  };

  const handleUpdateOption = (index: number, field: keyof AkinatorQuestionOption, val: string) => {
    const next = [...options];
    next[index] = { ...next[index], [field]: val };
    setOptions(next);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  // Handlers for Visibility Conditions
  const handleAddVisibilityItem = () => {
    const defaultCode = otherQuestions.length > 0 ? otherQuestions[0].code : '';
    setVisibilityItems([
      ...visibilityItems,
      { questionCode: defaultCode, operator: 'EQUALS', value: '' },
    ]);
  };

  const handleUpdateVisibilityItem = (
    index: number,
    field: keyof AkinatorSingleCondition,
    val: any
  ) => {
    const next = [...visibilityItems];
    next[index] = { ...next[index], [field]: val };
    setVisibilityItems(next);
  };

  const handleRemoveVisibilityItem = (index: number) => {
    setVisibilityItems(visibilityItems.filter((_, i) => i !== index));
  };

  // Handlers for Next Question Rules
  const handleAddBranchRule = () => {
    const defaultTarget = otherQuestions.length > 0 ? otherQuestions[0].code : null;
    setNextRules([
      ...nextRules,
      {
        logic: 'AND',
        action: 'GOTO_QUESTION',
        targetQuestionCode: defaultTarget,
        conditions: [
          { questionCode: code || 'current', operator: 'EQUALS', value: '' },
        ],
        reason: 'Rẽ nhánh câu hỏi',
      },
    ]);
  };

  const handleUpdateBranchRule = (
    index: number,
    field: keyof AkinatorNextQuestionRule,
    val: any
  ) => {
    const next = [...nextRules];
    next[index] = { ...next[index], [field]: val };
    setNextRules(next);
  };

  const handleRemoveBranchRule = (index: number) => {
    setNextRules(nextRules.filter((_, i) => i !== index));
  };

  const handleAddRuleCondition = (ruleIndex: number) => {
    const next = [...nextRules];
    next[ruleIndex].conditions = [
      ...next[ruleIndex].conditions,
      { questionCode: code || 'current', operator: 'EQUALS', value: '' },
    ];
    setNextRules(next);
  };

  const handleUpdateRuleCondition = (
    ruleIndex: number,
    condIndex: number,
    field: keyof AkinatorSingleCondition,
    val: any
  ) => {
    const next = [...nextRules];
    const conds = [...next[ruleIndex].conditions];
    conds[condIndex] = { ...conds[condIndex], [field]: val };
    next[ruleIndex].conditions = conds;
    setNextRules(next);
  };

  const handleRemoveRuleCondition = (ruleIndex: number, condIndex: number) => {
    const next = [...nextRules];
    next[ruleIndex].conditions = next[ruleIndex].conditions.filter((_, i) => i !== condIndex);
    setNextRules(next);
  };

  // Save validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Vui lòng nhập mã câu hỏi (code)');
      setActiveTab('basic');
      return;
    }

    if (!/^[A-Za-z0-9_]+$/.test(trimmedCode)) {
      setError('Mã câu hỏi chỉ được chứa chữ cái, số và dấu gạch dưới (_)');
      setActiveTab('basic');
      return;
    }

    // Check duplicate code if creating new or renaming
    const isDuplicate = existingQuestions.some(
      (q) => q.code === trimmedCode && q.id !== question?.id && q.code !== question?.code
    );
    if (isDuplicate) {
      setError(`Mã câu hỏi '${trimmedCode}' đã tồn tại trong phiên bản này`);
      setActiveTab('basic');
      return;
    }

    if (!questionText.trim()) {
      setError('Vui lòng nhập nội dung câu hỏi');
      setActiveTab('basic');
      return;
    }

    // Check options for choice types
    if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') {
      if (options.length < 2) {
        setError('Câu hỏi lựa chọn phải có ít nhất 2 phương án trả lời');
        setActiveTab('options');
        return;
      }
      for (const opt of options) {
        if (!opt.value.trim() || !opt.label.trim()) {
          setError('Tất cả phương án lựa chọn cần có đầy đủ Giá trị (Value) và Nhãn hiển thị (Label)');
          setActiveTab('options');
          return;
        }
      }
    }

    // Parse validation config
    const vc: Record<string, any> = {};
    if (valMin !== '') vc.min = Number(valMin);
    if (valMax !== '') vc.max = Number(valMax);
    if (valMinLength !== '') vc.minLength = parseInt(valMinLength, 10);
    if (valMaxLength !== '') vc.maxLength = parseInt(valMaxLength, 10);

    // Visibility config
    const visibilityConditions =
      hasVisibility && visibilityItems.length > 0
        ? {
            logic: visibilityLogic,
            conditions: visibilityItems.map((c) => {
              let parsedVal = c.value;
              if (parsedVal === 'true') parsedVal = true;
              else if (parsedVal === 'false') parsedVal = false;
              else if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = Number(parsedVal);
              return { ...c, value: parsedVal };
            }),
          }
        : null;

    // Next question rules
    const nextQuestionRules =
      nextRules.length > 0
        ? nextRules.map((r) => ({
            ...r,
            conditions: r.conditions.map((c) => {
              let parsedVal = c.value;
              if (parsedVal === 'true') parsedVal = true;
              else if (parsedVal === 'false') parsedVal = false;
              else if (!isNaN(Number(parsedVal)) && parsedVal !== '') parsedVal = Number(parsedVal);
              return { ...c, value: parsedVal };
            }),
          }))
        : null;

    const savedQuestion: AkinatorQuestionItem = {
      ...(question || {}),
      code: trimmedCode,
      questionText: questionText.trim(),
      description: description.trim() ? description.trim() : null,
      questionType,
      isEntryQuestion,
      isRequiredForEval,
      priorityWeight: Number(priorityWeight) || 50,
      mapsToCustomerField,
      options:
        questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE'
          ? options.map((o) => ({
              value: o.value.trim(),
              label: o.label.trim(),
              description: o.description?.trim() || null,
            }))
          : null,
      validationConfig: Object.keys(vc).length > 0 ? vc : null,
      visibilityConditions,
      nextQuestionRules,
      active: true,
    };

    onSave(savedQuestion);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>{question ? `Chỉnh sửa câu hỏi [${question.code}]` : 'Thêm câu hỏi mới'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cấu hình nội dung, loại câu hỏi, điều kiện hiển thị và rẽ nhánh thích ứng.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 gap-2 bg-slate-950/40 text-xs font-medium flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'basic'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Thông tin cơ bản</span>
          </button>

          {(questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') && (
            <button
              type="button"
              onClick={() => setActiveTab('options')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'options'
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Phương án trả lời ({options.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('visibility')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'visibility'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Điều kiện hiển thị {hasVisibility && visibilityItems.length > 0 ? `(${visibilityItems.length})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branching')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'branching'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Quy tắc rẽ nhánh {nextRules.length > 0 ? `(${nextRules.length})` : ''}</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB: BASIC */}
          {activeTab === 'basic' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Mã câu hỏi (Code) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s+/g, '_'))}
                    placeholder="Ví dụ: q_monthly_income"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dùng làm định danh duy nhất trong cây logic (chữ cái, số, gạch dưới).
                  </p>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Loại câu hỏi <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as AkinatorQuestionType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Nội dung câu hỏi <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Nhập nội dung câu hỏi hiển thị cho khách hàng..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Mô tả / Hướng dẫn phụ (tùy chọn)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ví dụ: Chọn mục tiêu chính bạn quan tâm trong 3 tháng tới"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Badges & Configuration Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEntryQuestion}
                      onChange={(e) => setIsEntryQuestion(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-200">
                      Câu hỏi mở đầu phiên quiz (isEntryQuestion)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-5">
                    Được ưu tiên chọn làm câu hỏi đầu tiên khi khách hàng bắt đầu quiz.
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRequiredForEval}
                      onChange={(e) => setIsRequiredForEval(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-200">
                      Bắt buộc cho đánh giá (isRequiredForEval)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-5">
                    Nếu chưa trả lời, Rule Engine sẽ trả về trạng thái INSUFFICIENT_DATA.
                  </p>
                </div>
              </div>

              {/* Priority & Mapping */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Trọng số ưu tiên (priorityWeight: 0 - 1000)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={priorityWeight}
                    onChange={(e) => setPriorityWeight(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Trọng số cao hơn được ưu tiên hỏi trước khi có nhiều câu hỏi hợp lệ.
                  </p>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Ánh xạ sang trường Khách hàng CRM
                  </label>
                  <select
                    value={mapsToCustomerField}
                    onChange={(e) => setMapsToCustomerField(e.target.value as AkinatorCustomerFieldMapping)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 outline-none"
                  >
                    {CUSTOMER_FIELD_MAPPINGS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Trích xuất tự động vào hồ sơ Admin xử lý khi hoàn tất quiz.
                  </p>
                </div>
              </div>

              {/* Numerical / Text bounds */}
              {(questionType === 'CURRENCY' || questionType === 'NUMBER' || questionType === 'TEXT') && (
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-3 pt-3">
                  <span className="font-semibold text-slate-300 block">
                    Giới hạn giá trị (Validation Config)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {(questionType === 'CURRENCY' || questionType === 'NUMBER') && (
                      <>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Giá trị tối thiểu (min):</label>
                          <input
                            type="number"
                            value={valMin}
                            onChange={(e) => setValMin(e.target.value)}
                            placeholder="Không giới hạn"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Giá trị tối đa (max):</label>
                          <input
                            type="number"
                            value={valMax}
                            onChange={(e) => setValMax(e.target.value)}
                            placeholder="Không giới hạn"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          />
                        </div>
                      </>
                    )}
                    {questionType === 'TEXT' && (
                      <>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Độ dài tối thiểu (minLength):</label>
                          <input
                            type="number"
                            value={valMinLength}
                            onChange={(e) => setValMinLength(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Độ dài tối đa (maxLength):</label>
                          <input
                            type="number"
                            value={valMaxLength}
                            onChange={(e) => setValMaxLength(e.target.value)}
                            placeholder="500"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: OPTIONS */}
          {activeTab === 'options' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Danh sách phương án trả lời ({options.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cần tối thiểu 2 phương án trả lời cho câu hỏi dạng lựa chọn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm phương án</span>
                </button>
              </div>

              <div className="space-y-3">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[11px] text-slate-400 flex-shrink-0 mt-1 font-mono">
                      {idx + 1}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Giá trị (Value / Mã):</label>
                        <input
                          type="text"
                          value={opt.value}
                          onChange={(e) => handleUpdateOption(idx, 'value', e.target.value.replace(/\s+/g, '_'))}
                          placeholder="Mã lưu trữ, ví dụ: CONSUMER"
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Nhãn hiển thị (Label):</label>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => handleUpdateOption(idx, 'label', e.target.value)}
                          placeholder="Tiêu đề phương án..."
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">Ghi chú phụ (Description - tùy chọn):</label>
                        <input
                          type="text"
                          value={opt.description || ''}
                          onChange={(e) => handleUpdateOption(idx, 'description', e.target.value)}
                          placeholder="Ghi chú chi tiết cho phương án này..."
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      disabled={options.length <= 2}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1"
                      title={options.length <= 2 ? 'Cần tối thiểu 2 phương án' : 'Xóa phương án'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: VISIBILITY CONDITIONS */}
          {activeTab === 'visibility' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      Khái niệm: Điều kiện hiển thị (Visibility Condition)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Quyết định câu hỏi này có được phép xuất hiện hay bị ẩn hoàn toàn dựa trên câu trả lời các câu trước.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasVisibility}
                      onChange={(e) => setHasVisibility(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                    />
                    <span className="font-medium text-slate-300">Bật điều kiện</span>
                  </label>
                </div>

                {hasVisibility && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-[11px]">Logic kết hợp:</span>
                      <div className="flex rounded-lg border border-slate-800 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setVisibilityLogic('AND')}
                          className={`px-3 py-1 font-semibold text-xs ${
                            visibilityLogic === 'AND'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Tất cả điều kiện (AND)
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibilityLogic('OR')}
                          className={`px-3 py-1 font-semibold text-xs ${
                            visibilityLogic === 'OR'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Bất kỳ điều kiện (OR)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {visibilityItems.map((cond, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2 flex-wrap"
                        >
                          <select
                            value={cond.questionCode}
                            onChange={(e) => handleUpdateVisibilityItem(idx, 'questionCode', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none"
                          >
                            <option value="">-- Chọn câu hỏi điều kiện --</option>
                            {otherQuestions.map((q) => (
                              <option key={q.code} value={q.code}>
                                {q.code} ({q.questionText.slice(0, 30)}...)
                              </option>
                            ))}
                          </select>

                          <select
                            value={cond.operator}
                            onChange={(e) => handleUpdateVisibilityItem(idx, 'operator', e.target.value as AkinatorConditionOperator)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none"
                          >
                            {CONDITION_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {!['IS_ANSWERED', 'IS_NOT_ANSWERED'].includes(cond.operator) && (
                            <input
                              type="text"
                              value={cond.value !== undefined ? String(cond.value) : ''}
                              onChange={(e) => handleUpdateVisibilityItem(idx, 'value', e.target.value)}
                              placeholder="Giá trị so sánh..."
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none flex-1 min-w-[120px]"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveVisibilityItem(idx)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddVisibilityItem}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm điều kiện hiển thị</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: BRANCHING RULES */}
          {activeTab === 'branching' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Quy tắc chuyển nhánh sau câu hỏi này ({nextRules.length})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Khái niệm: Sau khi người dùng trả lời câu hỏi này, rẽ nhánh trực tiếp sang câu hỏi đích (GOTO_QUESTION) hoặc kết thúc sớm (END_QUIZ).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBranchRule}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm quy tắc rẽ nhánh</span>
                </button>
              </div>

              {nextRules.length === 0 ? (
                <div className="py-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  Chưa có quy tắc rẽ nhánh trực tiếp nào. Hệ thống sẽ tự động chọn câu hỏi kế tiếp theo trọng số ưu tiên (priorityWeight).
                </div>
              ) : (
                <div className="space-y-4">
                  {nextRules.map((rule, rIdx) => (
                    <div
                      key={rIdx}
                      className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-400">
                          Quy tắc #{rIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBranchRule(rIdx)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded"
                          title="Xóa quy tắc này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Hành động rẽ nhánh (Action):</label>
                          <select
                            value={rule.action}
                            onChange={(e) => handleUpdateBranchRule(rIdx, 'action', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                          >
                            <option value="GOTO_QUESTION">Rẽ sang câu hỏi đích (GOTO_QUESTION)</option>
                            <option value="END_QUIZ">Dừng quiz sớm (END_QUIZ)</option>
                          </select>
                        </div>

                        {rule.action === 'GOTO_QUESTION' && (
                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">Câu hỏi đích (targetQuestionCode):</label>
                            <select
                              value={rule.targetQuestionCode || ''}
                              onChange={(e) => handleUpdateBranchRule(rIdx, 'targetQuestionCode', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none"
                            >
                              <option value="">-- Chọn câu hỏi đích --</option>
                              {otherQuestions.map((q) => (
                                <option key={q.code} value={q.code}>
                                  {q.code} ({q.questionText.slice(0, 30)}...)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-slate-400 block mb-1">Lý do rẽ nhánh (Audit Traceability):</label>
                          <input
                            type="text"
                            value={rule.reason || ''}
                            onChange={(e) => handleUpdateBranchRule(rIdx, 'reason', e.target.value)}
                            placeholder="Ghi chú lý do rẽ nhánh để kiểm tra audit..."
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 outline-none"
                          />
                        </div>
                      </div>

                      {/* Rule conditions */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <span className="text-[11px] text-slate-400 font-medium block">
                          Điều kiện kích hoạt quy tắc:
                        </span>
                        {rule.conditions.map((cond, cIdx) => (
                          <div
                            key={cIdx}
                            className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center gap-2 flex-wrap"
                          >
                            <input
                              type="text"
                              value={cond.questionCode}
                              onChange={(e) => handleUpdateRuleCondition(rIdx, cIdx, 'questionCode', e.target.value)}
                              placeholder="Mã câu hỏi (mặc định câu này)"
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs outline-none w-36"
                            />
                            <select
                              value={cond.operator}
                              onChange={(e) => handleUpdateRuleCondition(rIdx, cIdx, 'operator', e.target.value as AkinatorConditionOperator)}
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none"
                            >
                              {CONDITION_OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={cond.value !== undefined ? String(cond.value) : ''}
                              onChange={(e) => handleUpdateRuleCondition(rIdx, cIdx, 'value', e.target.value)}
                              placeholder="Giá trị đáp án..."
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs outline-none flex-1 min-w-[100px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveRuleCondition(rIdx, cIdx)}
                              className="text-slate-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddRuleCondition(rIdx)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm điều kiện cho quy tắc này</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Lưu câu hỏi vào bản nháp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
