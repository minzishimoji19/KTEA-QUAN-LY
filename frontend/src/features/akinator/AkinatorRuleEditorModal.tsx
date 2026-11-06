/**
 * AkinatorRuleEditorModal.tsx
 *
 * Modal for creating and editing deterministic evaluation rules in a Draft Akinator Configuration.
 * Configures:
 * - Rule identification & priority order
 * - Required question codes (if unanswered -> INSUFFICIENT_DATA)
 * - Matching conditions (AND/OR logic)
 * - Outcome payload (reference title, summary, directions, cautions, suggested priority)
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Scale,
  Compass,
  Layers,
  Link2,
} from 'lucide-react';
import {
  AkinatorRuleItem,
  AkinatorQuestionItem,
  AkinatorSingleCondition,
  AkinatorConditionSubGroup,
  AkinatorConditionOperator,
  PriorityLevel,
} from '../../types/akinator';

interface Props {
  isOpen: boolean;
  rule: AkinatorRuleItem | null;
  availableQuestions: AkinatorQuestionItem[];
  existingRules: AkinatorRuleItem[];
  onClose: () => void;
  onSave: (savedRule: AkinatorRuleItem) => void;
}

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

const PRIORITY_LEVELS: Array<{ value: PriorityLevel; label: string }> = [
  { value: 'CHUA_CO_NHU_CAU', label: 'Chưa có nhu cầu rõ ràng' },
  { value: 'THANH_KHOAN', label: 'Ưu tiên Thanh khoản' },
  { value: 'TIN_DUNG', label: 'Ưu tiên Tín dụng' },
  { value: 'THANH_KHOAN_TIN_DUNG', label: 'Ưu tiên Cao (Cả Thanh khoản & Tín dụng)' },
];

export const AkinatorRuleEditorModal: React.FC<Props> = ({
  isOpen,
  rule,
  availableQuestions,
  existingRules,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'conditions' | 'outcome'>('info');
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priorityOrder, setPriorityOrder] = useState<number>(1);
  const [requiredQuestionCodes, setRequiredQuestionCodes] = useState<string[]>([]);

  // Condition group
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<AkinatorSingleCondition[]>([]);
  const [conditionGroups, setConditionGroups] = useState<AkinatorConditionSubGroup[]>([]);

  // Outcome payload
  const [categoryCode, setCategoryCode] = useState<string>('');
  const [categoryLabel, setCategoryLabel] = useState<string>('');
  const [referenceTitle, setReferenceTitle] = useState<string>('');
  const [referenceSummary, setReferenceSummary] = useState<string>('');
  const [directionsText, setDirectionsText] = useState<string>('');
  const [cautionsText, setCautionsText] = useState<string>('');
  const [suggestedPriority, setSuggestedPriority] = useState<PriorityLevel | ''>('');
  const [registrationUrl, setRegistrationUrl] = useState<string>('');

  const formatCondValueForInput = (val: any): any => {
    if (Array.isArray(val)) return val.join(', ');
    return val;
  };

  useEffect(() => {
    if (rule) {
      setCode(rule.code || '');
      setName(rule.name || '');
      setDescription(rule.description || '');
      setPriorityOrder(rule.priorityOrder ?? 1);
      setRequiredQuestionCodes(rule.requiredQuestionCodes ? [...rule.requiredQuestionCodes] : []);

      setLogic(rule.conditions?.logic || 'AND');
      setConditions(
        rule.conditions?.conditions
          ? rule.conditions.conditions.map((c) => ({
              ...c,
              value: formatCondValueForInput(c.value),
            }))
          : []
      );
      setConditionGroups(
        rule.conditions?.groups
          ? rule.conditions.groups.map((g, idx) => ({
              id: g.id || `grp_${idx + 1}`,
              logic: g.logic || 'OR',
              conditions: (g.conditions || []).map((c) => ({
                ...c,
                value: formatCondValueForInput(c.value),
              })),
            }))
          : []
      );

      const op = rule.outcomePayload || {};
      setCategoryCode(op.categoryCode || '');
      setCategoryLabel(op.categoryLabel || '');
      setReferenceTitle(op.referenceTitle || '');
      setReferenceSummary(op.referenceSummary || '');
      setDirectionsText(op.suggestedDirections ? op.suggestedDirections.join('\n') : '');
      setCautionsText(op.cautionNotes ? op.cautionNotes.join('\n') : '');
      setSuggestedPriority(op.suggestedPriority || '');
      setRegistrationUrl(op.registrationUrl || '');
    } else {
      // Defaults for new rule
      const nextOrder = existingRules.length + 1;
      setCode(`RULE_CASE_${nextOrder}`);
      setName('');
      setDescription('');
      setPriorityOrder(nextOrder);
      setRequiredQuestionCodes([]);
      setLogic('AND');
      const defaultQ = availableQuestions.length > 0 ? availableQuestions[0].code : '';
      setConditions([{ questionCode: defaultQ, operator: 'EQUALS', value: '' }]);
      setConditionGroups([]);
      setCategoryCode(`CAT_${nextOrder}`);
      setCategoryLabel('');
      setReferenceTitle('');
      setReferenceSummary('');
      setDirectionsText('');
      setCautionsText('');
      setSuggestedPriority('');
      setRegistrationUrl('');
    }
    setActiveTab('info');
    setError(null);
  }, [rule, existingRules, availableQuestions, isOpen]);

  if (!isOpen) return null;

  const handleToggleRequiredQuestion = (qCode: string) => {
    if (requiredQuestionCodes.includes(qCode)) {
      setRequiredQuestionCodes(requiredQuestionCodes.filter((c) => c !== qCode));
    } else {
      setRequiredQuestionCodes([...requiredQuestionCodes, qCode]);
    }
  };

  const handleAddCondition = () => {
    const defaultQ = availableQuestions.length > 0 ? availableQuestions[0].code : '';
    setConditions([
      ...conditions,
      { questionCode: defaultQ, operator: 'EQUALS', value: '' },
    ]);
  };

  const handleUpdateCondition = (
    index: number,
    field: keyof AkinatorSingleCondition,
    val: any
  ) => {
    const next = [...conditions];
    next[index] = { ...next[index], [field]: val };
    setConditions(next);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddConditionGroup = () => {
    const defaultQ = availableQuestions.length > 0 ? availableQuestions[0].code : '';
    setConditionGroups([
      ...conditionGroups,
      {
        id: `grp_${Date.now()}_${conditionGroups.length + 1}`,
        logic: 'OR',
        conditions: [{ questionCode: defaultQ, operator: 'EQUALS', value: '' }],
      },
    ]);
  };

  const handleUpdateGroupLogic = (groupIndex: number, newLogic: 'AND' | 'OR') => {
    const next = [...conditionGroups];
    next[groupIndex] = { ...next[groupIndex], logic: newLogic };
    setConditionGroups(next);
  };

  const handleRemoveConditionGroup = (groupIndex: number) => {
    setConditionGroups(conditionGroups.filter((_, i) => i !== groupIndex));
  };

  const handleAddConditionInGroup = (groupIndex: number) => {
    const defaultQ = availableQuestions.length > 0 ? availableQuestions[0].code : '';
    const next = [...conditionGroups];
    next[groupIndex] = {
      ...next[groupIndex],
      conditions: [
        ...next[groupIndex].conditions,
        { questionCode: defaultQ, operator: 'EQUALS', value: '' },
      ],
    };
    setConditionGroups(next);
  };

  const handleUpdateConditionInGroup = (
    groupIndex: number,
    condIndex: number,
    field: keyof AkinatorSingleCondition,
    val: any
  ) => {
    const next = [...conditionGroups];
    const nextConds = [...next[groupIndex].conditions];
    nextConds[condIndex] = { ...nextConds[condIndex], [field]: val };
    next[groupIndex] = { ...next[groupIndex], conditions: nextConds };
    setConditionGroups(next);
  };

  const handleRemoveConditionInGroup = (groupIndex: number, condIndex: number) => {
    const next = [...conditionGroups];
    const nextConds = next[groupIndex].conditions.filter((_, i) => i !== condIndex);
    next[groupIndex] = { ...next[groupIndex], conditions: nextConds };
    setConditionGroups(next);
  };

  const normalizeConditionForSave = (c: AkinatorSingleCondition): AkinatorSingleCondition => {
    let parsedVal = c.value;
    if (c.operator === 'IN' || c.operator === 'NOT_IN') {
      if (Array.isArray(parsedVal)) {
        parsedVal = parsedVal.map((item) => String(item).trim()).filter(Boolean);
      } else if (typeof parsedVal === 'string') {
        const trimmed = parsedVal.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr)) {
              parsedVal = arr.map((item) => String(item).trim()).filter(Boolean);
            }
          } catch {
            parsedVal = trimmed
              .split(',')
              .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
              .filter(Boolean);
          }
        } else {
          parsedVal = trimmed
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
        }
      }
    } else if (parsedVal === 'true') {
      parsedVal = true;
    } else if (parsedVal === 'false') {
      parsedVal = false;
    } else if (
      typeof parsedVal === 'string' &&
      parsedVal.trim() !== '' &&
      !isNaN(Number(parsedVal))
    ) {
      parsedVal = Number(parsedVal);
    }
    return { ...c, value: parsedVal };
  };

  const totalConditionsCount =
    conditions.length +
    conditionGroups.reduce((acc, g) => acc + (g.conditions?.length || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Vui lòng nhập mã quy tắc (Rule Code)');
      setActiveTab('info');
      return;
    }

    if (!/^[A-Za-z0-9_]+$/.test(trimmedCode)) {
      setError('Mã quy tắc chỉ được chứa chữ cái, số và dấu gạch dưới (_)');
      setActiveTab('info');
      return;
    }

    const isDuplicate = existingRules.some(
      (r) => r.code === trimmedCode && r.id !== rule?.id && r.code !== rule?.code
    );
    if (isDuplicate) {
      setError(`Mã quy tắc '${trimmedCode}' đã tồn tại trong phiên bản này`);
      setActiveTab('info');
      return;
    }

    if (!name.trim()) {
      setError('Vui lòng nhập tên quy tắc');
      setActiveTab('info');
      return;
    }

    if (conditions.length === 0 && conditionGroups.length === 0) {
      setError('Cần ít nhất 1 điều kiện đơn lẻ hoặc 1 nhóm điều kiện cho quy tắc đánh giá');
      setActiveTab('conditions');
      return;
    }

    for (const c of conditions) {
      if (!c.questionCode) {
        setError('Tất cả điều kiện đơn lẻ cần chọn mã câu hỏi so sánh');
        setActiveTab('conditions');
        return;
      }
    }

    for (let gIdx = 0; gIdx < conditionGroups.length; gIdx++) {
      const grp = conditionGroups[gIdx];
      if (!grp.conditions || grp.conditions.length === 0) {
        setError(`Nhóm điều kiện #${gIdx + 1} không được để trống (cần ít nhất 1 điều kiện)`);
        setActiveTab('conditions');
        return;
      }
      for (const c of grp.conditions) {
        if (!c.questionCode) {
          setError(`Tất cả điều kiện trong Nhóm điều kiện #${gIdx + 1} cần chọn mã câu hỏi so sánh`);
          setActiveTab('conditions');
          return;
        }
      }
    }

    if (!categoryCode.trim() || !categoryLabel.trim()) {
      setError('Vui lòng nhập đầy đủ Mã nhóm và Nhãn nhóm phân loại kết quả');
      setActiveTab('outcome');
      return;
    }

    if (!referenceTitle.trim() || !referenceSummary.trim()) {
      setError('Vui lòng nhập Tiêu đề tham khảo và Nội dung tóm tắt kết quả');
      setActiveTab('outcome');
      return;
    }

    const trimmedRegUrl = registrationUrl.trim();
    if (trimmedRegUrl) {
      try {
        const parsed = new URL(trimmedRegUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setError('Đường dẫn đăng ký sản phẩm phải bắt đầu bằng http:// hoặc https://');
          setActiveTab('outcome');
          return;
        }
      } catch {
        setError('Đường dẫn đăng ký sản phẩm không hợp lệ (ví dụ: https://...)');
        setActiveTab('outcome');
        return;
      }
    }

    const suggestedDirections = directionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const cautionNotes = cautionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const savedRule: AkinatorRuleItem = {
      ...(rule || {}),
      code: trimmedCode,
      name: name.trim(),
      description: description.trim() || null,
      priorityOrder: Number(priorityOrder) || 1,
      requiredQuestionCodes,
      conditions: {
        logic,
        conditions: conditions.map(normalizeConditionForSave),
        ...(conditionGroups.length > 0
          ? {
              groups: conditionGroups.map((g, idx) => ({
                id: g.id || `grp_${idx + 1}`,
                logic: g.logic,
                conditions: g.conditions.map(normalizeConditionForSave),
              })),
            }
          : {}),
      },
      outcomePayload: {
        categoryCode: categoryCode.trim(),
        categoryLabel: categoryLabel.trim(),
        referenceTitle: referenceTitle.trim(),
        referenceSummary: referenceSummary.trim(),
        suggestedDirections,
        cautionNotes,
        suggestedPriority: (suggestedPriority as PriorityLevel) || null,
        registrationUrl: trimmedRegUrl || null,
      },
      stopOnMatch: false,
      active: true,
    };

    onSave(savedRule);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl shadow-black overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>{rule ? `Chỉnh sửa quy tắc [${rule.code}]` : 'Thêm quy tắc đánh giá mới'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Cấu hình logic khớp đáp án và kết quả đánh giá sơ bộ kèm khuyến cáo tham khảo.
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
            onClick={() => setActiveTab('info')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Quy tắc & Câu hỏi bắt buộc</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conditions')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'conditions'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>
              Điều kiện khớp ({totalConditionsCount}
              {conditionGroups.length > 0 ? ` • ${conditionGroups.length} nhóm` : ''})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outcome')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'outcome'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Kết quả tham khảo đề xuất</span>
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

          {/* TAB: INFO */}
          {activeTab === 'info' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="font-medium text-slate-300 block mb-1">
                    Mã quy tắc (Rule Code) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\s+/g, '_'))}
                    placeholder="Ví dụ: RULE_SME_COLLATERAL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Định danh duy nhất của quy tắc trong phiên bản.
                  </p>
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Thứ tự ưu tiên xét (Order) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={priorityOrder}
                    onChange={(e) => setPriorityOrder(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Số nhỏ hơn được đánh giá trước.
                  </p>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Tên quy tắc <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Khách hàng kinh doanh có tài sản đảm bảo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Mô tả / Ghi chú nội bộ quy tắc
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú logic hoặc căn cứ cho Admin..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none leading-relaxed"
                />
              </div>

              {/* Required Question Codes */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 pt-3">
                <div>
                  <span className="font-semibold text-slate-200 block">
                    Câu hỏi bắt buộc phải trả lời để quy tắc có hiệu lực (requiredQuestionCodes)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Nếu khách hàng chưa trả lời một trong các câu hỏi này, quy tắc sẽ không kết luận và báo INSUFFICIENT_DATA.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {availableQuestions.map((q) => {
                    const isChecked = requiredQuestionCodes.includes(q.code);
                    return (
                      <label
                        key={q.code}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRequiredQuestion(q.code)}
                          className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-medium block truncate">
                            {q.code}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {q.questionText}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONDITIONS */}
          {activeTab === 'conditions' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-slate-200">
                    Điều kiện khớp quy tắc (Conditions)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Quy tắc kích hoạt khi biểu thức điều kiện tổng thể bên dưới được thỏa mãn. Hỗ trợ kết hợp điều kiện đơn lẻ và nhóm điều kiện (AND / OR).
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded-lg border border-slate-800 overflow-hidden" title="Toán tử kết hợp ngoài cùng giữa các điều kiện và các nhóm điều kiện">
                    <button
                      type="button"
                      onClick={() => setLogic('AND')}
                      className={`px-3 py-1 font-semibold text-xs ${
                        logic === 'AND'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Tất cả (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogic('OR')}
                      className={`px-3 py-1 font-semibold text-xs ${
                        logic === 'OR'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Bất kỳ (OR)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm điều kiện</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddConditionGroup}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Thêm nhóm điều kiện</span>
                  </button>
                </div>
              </div>

              {/* Top-level Single Conditions */}
              {conditions.length > 0 && (
                <div className="space-y-2.5">
                  {conditionGroups.length > 0 && (
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Điều kiện đơn lẻ (Kết hợp theo {logic} ngoài cùng)
                    </div>
                  )}
                  {conditions.map((cond, idx) => {
                    const selectedQuestion = availableQuestions.find(
                      (q) => q.code === cond.questionCode
                    );
                    const qOptions = Array.isArray(selectedQuestion?.options)
                      ? selectedQuestion!.options!
                      : [];
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs text-slate-500 w-6 text-center">
                            #{idx + 1}
                          </span>

                          <select
                            value={cond.questionCode}
                            onChange={(e) =>
                              handleUpdateCondition(idx, 'questionCode', e.target.value)
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none flex-1 min-w-[160px]"
                          >
                            <option value="">-- Chọn câu hỏi kiểm tra --</option>
                            {availableQuestions.map((q) => (
                              <option key={q.code} value={q.code}>
                                {q.code} ({q.questionText.slice(0, 35)}...)
                              </option>
                            ))}
                          </select>

                          <select
                            value={cond.operator}
                            onChange={(e) =>
                              handleUpdateCondition(
                                idx,
                                'operator',
                                e.target.value as AkinatorConditionOperator
                              )
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none"
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
                              onChange={(e) =>
                                handleUpdateCondition(idx, 'value', e.target.value)
                              }
                              placeholder={
                                cond.operator === 'IN' || cond.operator === 'NOT_IN'
                                  ? 'Nhập các mã cách nhau dấu phẩy (VD: LOAN_ONLY, BOTH)'
                                  : 'Giá trị (ví dụ: true, 6000000, BUSINESS)'
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none flex-1 min-w-[150px]"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(idx)}
                            disabled={conditions.length <= 1 && conditionGroups.length === 0}
                            title="Xóa điều kiện"
                            className="text-slate-500 hover:text-red-400 p-1.5 rounded disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {qOptions.length > 0 &&
                          !['IS_ANSWERED', 'IS_NOT_ANSWERED'].includes(cond.operator) && (
                            <div className="pl-8 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-500">Gợi ý mã đáp án:</span>
                              {qOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    if (cond.operator === 'IN' || cond.operator === 'NOT_IN') {
                                      const currentStr = String(cond.value || '').trim();
                                      const parts = currentStr
                                        ? currentStr
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean)
                                        : [];
                                      const nextParts = parts.includes(opt.value)
                                        ? parts.filter((p) => p !== opt.value)
                                        : [...parts, opt.value];
                                      handleUpdateCondition(idx, 'value', nextParts.join(', '));
                                    } else {
                                      handleUpdateCondition(idx, 'value', opt.value);
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[10px] font-mono text-slate-300 transition-colors"
                                  title={opt.label}
                                >
                                  {opt.value} ({opt.label.slice(0, 22)})
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Nested Condition Groups (AND / OR) */}
              {conditionGroups.length > 0 && (
                <div className="space-y-3 pt-1">
                  {conditions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-px bg-slate-800 flex-1" />
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-emerald-400">
                        {logic === 'AND' ? 'VÀ (AND)' : 'HOẶC (OR)'}
                      </span>
                      <div className="h-px bg-slate-800 flex-1" />
                    </div>
                  )}

                  {conditionGroups.map((grp, grpIdx) => (
                    <React.Fragment key={grp.id || grpIdx}>
                      {grpIdx > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="h-px bg-slate-800 flex-1" />
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-bold text-emerald-400">
                            {logic === 'AND' ? 'VÀ (AND)' : 'HOẶC (OR)'}
                          </span>
                          <div className="h-px bg-slate-800 flex-1" />
                        </div>
                      )}

                      <div className="bg-indigo-950/15 border border-indigo-500/30 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-semibold text-xs">
                              <Layers className="w-3.5 h-3.5" />
                              Nhóm điều kiện #{grpIdx + 1}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ({grp.conditions.length} điều kiện bên trong nhóm)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex rounded-lg border border-indigo-500/40 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleUpdateGroupLogic(grpIdx, 'AND')}
                                className={`px-2.5 py-1 font-semibold text-[11px] ${
                                  grp.logic === 'AND'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Tất cả trong nhóm (AND)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateGroupLogic(grpIdx, 'OR')}
                                className={`px-2.5 py-1 font-semibold text-[11px] ${
                                  grp.logic === 'OR'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Bất kỳ trong nhóm (OR)
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddConditionInGroup(grpIdx)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-medium transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Thêm điều kiện</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveConditionGroup(grpIdx)}
                              title="Xóa nhóm điều kiện này"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 text-[11px] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa nhóm</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 pl-2 border-l-2 border-indigo-500/30">
                          {grp.conditions.map((cond, cIdx) => {
                            const selectedQuestion = availableQuestions.find(
                              (q) => q.code === cond.questionCode
                            );
                            const qOptions = Array.isArray(selectedQuestion?.options)
                              ? selectedQuestion!.options!
                              : [];
                            return (
                              <div
                                key={cIdx}
                                className="bg-slate-950/90 p-2.5 rounded-lg border border-slate-800 space-y-2"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[11px] text-indigo-400 w-8 text-center">
                                    #{grpIdx + 1}.{cIdx + 1}
                                  </span>

                                  <select
                                    value={cond.questionCode}
                                    onChange={(e) =>
                                      handleUpdateConditionInGroup(
                                        grpIdx,
                                        cIdx,
                                        'questionCode',
                                        e.target.value
                                      )
                                    }
                                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none flex-1 min-w-[150px]"
                                  >
                                    <option value="">-- Chọn câu hỏi kiểm tra --</option>
                                    {availableQuestions.map((q) => (
                                      <option key={q.code} value={q.code}>
                                        {q.code} ({q.questionText.slice(0, 35)}...)
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    value={cond.operator}
                                    onChange={(e) =>
                                      handleUpdateConditionInGroup(
                                        grpIdx,
                                        cIdx,
                                        'operator',
                                        e.target.value as AkinatorConditionOperator
                                      )
                                    }
                                    className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none"
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
                                      onChange={(e) =>
                                        handleUpdateConditionInGroup(
                                          grpIdx,
                                          cIdx,
                                          'value',
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        cond.operator === 'IN' || cond.operator === 'NOT_IN'
                                          ? 'Nhập các mã cách nhau dấu phẩy (VD: LOAN_ONLY, BOTH)'
                                          : 'Giá trị (ví dụ: true, 6000000, BUSINESS)'
                                      }
                                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none flex-1 min-w-[140px]"
                                    />
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveConditionInGroup(grpIdx, cIdx)}
                                    disabled={grp.conditions.length <= 1}
                                    title="Xóa điều kiện trong nhóm"
                                    className="text-slate-500 hover:text-red-400 p-1.5 rounded disabled:opacity-30"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {qOptions.length > 0 &&
                                  !['IS_ANSWERED', 'IS_NOT_ANSWERED'].includes(cond.operator) && (
                                    <div className="pl-9 flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] text-slate-500">
                                        Gợi ý mã đáp án:
                                      </span>
                                      {qOptions.map((opt) => (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => {
                                            if (
                                              cond.operator === 'IN' ||
                                              cond.operator === 'NOT_IN'
                                            ) {
                                              const currentStr = String(cond.value || '').trim();
                                              const parts = currentStr
                                                ? currentStr
                                                    .split(',')
                                                    .map((s) => s.trim())
                                                    .filter(Boolean)
                                                : [];
                                              const nextParts = parts.includes(opt.value)
                                                ? parts.filter((p) => p !== opt.value)
                                                : [...parts, opt.value];
                                              handleUpdateConditionInGroup(
                                                grpIdx,
                                                cIdx,
                                                'value',
                                                nextParts.join(', ')
                                              );
                                            } else {
                                              handleUpdateConditionInGroup(
                                                grpIdx,
                                                cIdx,
                                                'value',
                                                opt.value
                                              );
                                            }
                                          }}
                                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-[10px] font-mono text-slate-300 transition-colors"
                                          title={opt.label}
                                        >
                                          {opt.value} ({opt.label.slice(0, 22)})
                                        </button>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: OUTCOME */}
          {activeTab === 'outcome' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Mã nhóm (categoryCode) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={categoryCode}
                    onChange={(e) => setCategoryCode(e.target.value.replace(/\s+/g, '_'))}
                    placeholder="Ví dụ: BIZ_COLLATERAL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Nhãn nhóm hiển thị (categoryLabel) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={categoryLabel}
                    onChange={(e) => setCategoryLabel(e.target.value)}
                    placeholder="Ví dụ: Vốn kinh doanh có TSĐB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Tiêu đề tham khảo / Tên sản phẩm (referenceTitle) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={referenceTitle}
                  onChange={(e) => setReferenceTitle(e.target.value)}
                  placeholder="Ví dụ: Giải pháp Bổ sung vốn kinh doanh có Tài sản đảm bảo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 space-y-1.5">
                <label className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Đường dẫn đăng ký sản phẩm / khoản vay (Registration URL)</span>
                </label>
                <input
                  type="url"
                  value={registrationUrl}
                  onChange={(e) => setRegistrationUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none font-mono"
                />
                <p className="text-[11px] text-slate-400">
                  Khi sản phẩm/quy tắc này khớp với thông tin khách hàng, hệ thống sẽ hiển thị nút{' '}
                  <strong className="text-emerald-300">&quot;Đăng ký ngay&quot;</strong> dẫn tới đường link này (mở tab mới). Để trống nếu chưa có link đăng ký.
                </p>
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Nội dung tóm tắt sơ bộ (referenceSummary) <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={referenceSummary}
                  onChange={(e) => setReferenceSummary(e.target.value)}
                  placeholder="Mô tả tóm tắt giải pháp tài chính gợi ý cho khách hàng..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Các bước gợi ý tiếp theo (mỗi dòng một bước):
                </label>
                <textarea
                  rows={3}
                  value={directionsText}
                  onChange={(e) => setDirectionsText(e.target.value)}
                  placeholder="Ví dụ:&#10;Chuẩn bị giấy phép đăng ký kinh doanh&#10;Chuẩn bị sao kê tài khoản 6 tháng gần nhất"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Điểm cần lưu ý / Cảnh báo (mỗi dòng một lưu ý):
                </label>
                <textarea
                  rows={2}
                  value={cautionsText}
                  onChange={(e) => setCautionsText(e.target.value)}
                  placeholder="Ví dụ: Cần thẩm định thực tế tài sản đảm bảo theo quy định ngân hàng"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Mức độ ưu tiên đề xuất cho hồ sơ (suggestedPriority)
                </label>
                <select
                  value={suggestedPriority}
                  onChange={(e) => setSuggestedPriority(e.target.value as PriorityLevel | '')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:border-emerald-500 outline-none"
                >
                  <option value="">-- Mặc định (Không đặt trước) --</option>
                  {PRIORITY_LEVELS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
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
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Lưu quy tắc vào bản nháp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
