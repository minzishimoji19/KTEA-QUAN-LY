import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Plus,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  AlertCircle,
  Save,
  Lock,
  X,
  Sparkles,
  Share2,
  Copy,
  ExternalLink,
  Ban,
  Globe,
  Compass,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AssessmentRecommendationModal } from './AssessmentRecommendationModal';
import { Assessment } from '../../types/assessment';
import { Questionnaire, QuestionDefinition } from '../../types/questionnaire';
import assessmentService from '../../services/assessmentService';
import questionnaireService from '../../services/questionnaireService';
import {
  publicSurveyService,
  PublicSurveyLinkItem,
} from '../../services/publicSurveyService';
import {
  akinatorCustomerApi,
} from '../../services/akinatorService';
import {
  CustomerAkinatorSessionItem,
  CustomerAkinatorLatestResult,
} from '../../types/akinator';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { DateDisplay } from '../../components/common';
import { VietnameseDatePicker } from '../../components/ui/VietnameseDatePicker';

interface CustomerAssessmentsTabProps {
  customerId: string;
  customerName: string;
}

export const CustomerAssessmentsTab: React.FC<CustomerAssessmentsTabProps> = ({
  customerId,
  customerName,
}) => {
  const { toast } = useToast();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal: Start New Assessment
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [availableQuestionnaires, setAvailableQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [startNotes, setStartNotes] = useState<string>('');
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Modal: Assessment Runner / Viewer
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [isRunnerOpen, setIsRunnerOpen] = useState<boolean>(false);
  const [recModalAssessment, setRecModalAssessment] = useState<{ id: string; title: string } | null>(null);

  // Public Survey Links State
  const [surveyLinks, setSurveyLinks] = useState<PublicSurveyLinkItem[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState<boolean>(false);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState<boolean>(false);
  const [linkQuestionnaireId, setLinkQuestionnaireId] = useState<string>('');
  const [linkNotes, setLinkNotes] = useState<string>('');
  const [isCreatingLink, setIsCreatingLink] = useState<boolean>(false);
  const [createdLinkResult, setCreatedLinkResult] = useState<{ url: string; expiresAt: string } | null>(null);

  // Akinator Evaluation State
  const [akinatorSessions, setAkinatorSessions] = useState<CustomerAkinatorSessionItem[]>([]);
  const [latestAkinatorResult, setLatestAkinatorResult] = useState<CustomerAkinatorLatestResult | null>(null);
  const [isLoadingAkinator, setIsLoadingAkinator] = useState<boolean>(true);
  const [isCreateAkinatorModalOpen, setIsCreateAkinatorModalOpen] = useState<boolean>(false);
  const [isCreatingAkinatorLink, setIsCreatingAkinatorLink] = useState<boolean>(false);
  const [createdAkinatorLinkResult, setCreatedAkinatorLinkResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [selectedAkinatorDetail, setSelectedAkinatorDetail] = useState<CustomerAkinatorLatestResult | null>(null);
  const [isAkinatorDetailOpen, setIsAkinatorDetailOpen] = useState<boolean>(false);
  const [showLegacySection, setShowLegacySection] = useState<boolean>(false);

  // Load Akinator customer sessions & latest completed result
  const loadAkinatorData = async () => {
    setIsLoadingAkinator(true);
    try {
      const [sessions, latest] = await Promise.all([
        akinatorCustomerApi.getSessions(customerId),
        akinatorCustomerApi.getLatestResult(customerId),
      ]);
      setAkinatorSessions(sessions);
      setLatestAkinatorResult(latest);
    } catch (err: any) {
      console.error('Không thể tải dữ liệu Akinator:', err);
    } finally {
      setIsLoadingAkinator(false);
    }
  };

  // Load customer assessments
  const loadAssessments = async () => {
    setIsLoading(true);
    try {
      const data = await assessmentService.getAssessmentsByCustomer(customerId);
      setAssessments(data);
    } catch (err: any) {
      toast.error('Không thể tải lịch sử khảo sát: ' + (err.message || 'Lỗi mạng'));
    } finally {
      setIsLoading(false);
    }
  };

  // Load public survey links
  const loadSurveyLinks = async () => {
    setIsLoadingLinks(true);
    try {
      const list = await publicSurveyService.listLinks(customerId);
      setSurveyLinks(list);
    } catch (err: any) {
      console.error('Không thể tải danh sách link khảo sát:', err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  useEffect(() => {
    loadAssessments();
    loadSurveyLinks();
    loadAkinatorData();
  }, [customerId]);

  const handleOpenCreateAkinatorModal = () => {
    setCreatedAkinatorLinkResult(null);
    setIsCreateAkinatorModalOpen(true);
  };

  const handleCreateAkinatorLink = async () => {
    setIsCreatingAkinatorLink(true);
    try {
      const res = await akinatorCustomerApi.createLink(customerId);
      const finalUrl = res.publicUrl || `${window.location.origin}/quiz?token=${res.rawToken}`;
      setCreatedAkinatorLinkResult({ url: finalUrl, expiresAt: res.expiresAt });
      toast.success('Đã tạo link Akinator mới cho khách hàng thành công');
      await loadAkinatorData();
    } catch (err: any) {
      toast.error('Lỗi khi tạo link Akinator: ' + (err.message || ''));
    } finally {
      setIsCreatingAkinatorLink(false);
    }
  };

  const handleRevokeAkinatorSession = async (sessionId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi link làm Akinator này của khách hàng? Khách sẽ không thể tiếp tục bài đánh giá.')) {
      return;
    }
    try {
      await akinatorCustomerApi.revokeSession(sessionId, customerId);
      toast.success('Đã thu hồi link Akinator thành công');
      await loadAkinatorData();
    } catch (err: any) {
      toast.error('Lỗi khi thu hồi link: ' + (err.message || ''));
    }
  };

  const handleOpenCreateLinkModal = async () => {
    setCreatedLinkResult(null);
    setLinkNotes('');
    setIsCreateLinkModalOpen(true);
    try {
      const qList = await questionnaireService.getQuestionnaires(true);
      const withPub = qList.filter(
        (q) => q.active !== false && q.versions?.some((v) => v.status === 'PUBLISHED')
      );
      setAvailableQuestionnaires(withPub);
      if (withPub.length > 0) {
        setLinkQuestionnaireId(withPub[0].id);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh mục bộ câu hỏi: ' + (err.message || ''));
    }
  };

  const handleCreateSurveyLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkQuestionnaireId) {
      toast.error('Vui lòng chọn bộ câu hỏi');
      return;
    }
    setIsCreatingLink(true);
    try {
      const res = await publicSurveyService.createLink(customerId, {
        questionnaireId: linkQuestionnaireId,
        notes: linkNotes.trim() || null,
      });
      const finalUrl = res.rawToken
        ? `${window.location.origin}/survey/${res.rawToken}`
        : res.publicUrl;
      setCreatedLinkResult({ url: finalUrl, expiresAt: res.expiresAt });
      toast.success('Đã tạo link khảo sát thành công');
      await loadSurveyLinks();
      await loadAssessments();
    } catch (err: any) {
      toast.error('Không thể tạo link khảo sát: ' + (err.message || ''));
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Đã sao chép link khảo sát!');
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi link khảo sát này? Khách hàng sẽ không thể truy cập khảo sát này nữa.')) {
      return;
    }
    try {
      await publicSurveyService.revokeLink(linkId);
      toast.success('Đã thu hồi link khảo sát thành công');
      await loadSurveyLinks();
      await loadAssessments();
    } catch (err: any) {
      toast.error('Lỗi khi thu hồi link: ' + (err.message || ''));
    }
  };

  // Open Start Modal and load published questionnaires
  const handleOpenStartModal = async () => {
    setIsStartModalOpen(true);
    try {
      const qList = await questionnaireService.getQuestionnaires(true);
      // Filter only questionnaires that have at least one PUBLISHED version
      const withPub = qList.filter((q) =>
        q.versions?.some((v) => v.status === 'PUBLISHED')
      );
      setAvailableQuestionnaires(withPub);
      if (withPub.length > 0) {
        setSelectedQuestionnaireId(withPub[0].id);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh mục bộ câu hỏi: ' + (err.message || ''));
    }
  };

  // Start Assessment
  const handleStartAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuestionnaireId) {
      toast.error('Vui lòng chọn bộ câu hỏi');
      return;
    }

    setIsStarting(true);
    try {
      const created = await assessmentService.startAssessment(customerId, {
        questionnaireId: selectedQuestionnaireId,
        notes: startNotes.trim() || null,
      });
      toast.success('Đã tạo lượt khảo sát nhu cầu thành công');
      setIsStartModalOpen(false);
      setStartNotes('');
      await loadAssessments();
      // Open runner immediately
      const full = await assessmentService.getAssessmentById(created.id);
      setActiveAssessment(full);
      setIsRunnerOpen(true);
    } catch (err: any) {
      toast.error('Lỗi khi bắt đầu khảo sát: ' + (err.message || ''));
    } finally {
      setIsStarting(false);
    }
  };

  // Open existing assessment
  const handleOpenAssessment = async (assessmentId: string) => {
    try {
      const full = await assessmentService.getAssessmentById(assessmentId);
      setActiveAssessment(full);
      setIsRunnerOpen(true);
    } catch (err: any) {
      toast.error('Không thể tải chi tiết bài khảo sát: ' + (err.message || ''));
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HEADER BAR: PRIMARY AKINATOR WORKSPACE ACTIONS                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-semibold text-slate-100">
              Đánh giá Nhu cầu Akinator & Khảo sát ({akinatorSessions.length + assessments.length})
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Đánh giá nhu cầu thích ứng thông minh (Akinator) cho khách hàng <strong className="text-slate-200">{customerName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleOpenCreateAkinatorModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tạo link Akinator gửi khách</span>
          </button>

          <button
            onClick={() => setShowLegacySection(!showLegacySection)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            title="Xem hoặc ẩn dữ liệu khảo sát cũ trước đây"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Khảo sát cũ ({assessments.length})</span>
            {showLegacySection ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. AKINATOR: LATEST COMPLETED EVALUATION RESULT CARD                      */}
      {/* ========================================================================= */}
      {isLoadingAkinator ? (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
          <Skeleton className="h-28 w-full rounded-lg bg-slate-800/40" />
        </div>
      ) : latestAkinatorResult ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-500/20">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>KẾT QUẢ HOÀN THÀNH MỚI NHẤT</span>
              </span>
              <span className="text-xs text-slate-400">
                Lần đánh giá hợp lệ gần nhất:{' '}
                <DateDisplay date={latestAkinatorResult.completedAt} showTime className="text-slate-200 font-medium font-mono" />
              </span>
              {latestAkinatorResult.createdBy && (
                <span className="text-[11px] text-slate-400">
                  (Khởi tạo bởi: <strong className="text-slate-300">{latestAkinatorResult.createdBy.fullName}</strong>)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                  latestAkinatorResult.result.evaluationStatus === 'EVALUATED'
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                }`}
              >
                {latestAkinatorResult.result.evaluationStatus === 'EVALUATED' ? 'ĐÃ ĐÁNH GIÁ ĐỦ TIÊU CHÍ' : 'CHƯA ĐỦ DỮ LIỆU'}
              </span>
              <button
                onClick={() => {
                  setSelectedAkinatorDetail(latestAkinatorResult);
                  setIsAkinatorDetailOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors border border-slate-700"
              >
                <Eye className="w-3 h-3 text-emerald-400" />
                <span>Chi tiết câu trả lời</span>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{latestAkinatorResult.result.summaryTitle}</span>
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {latestAkinatorResult.result.summaryDescription}
            </p>
          </div>

          {/* Categories Grid */}
          {latestAkinatorResult.result.outcomeData?.categories &&
            latestAkinatorResult.result.outcomeData.categories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {latestAkinatorResult.result.outcomeData.categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {cat.categoryLabel}
                      </span>
                      {cat.suggestedPriority && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {cat.suggestedPriority}
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-200 text-[11px]">{cat.referenceTitle}</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">{cat.referenceSummary}</div>

                    {cat.suggestedDirections && cat.suggestedDirections.length > 0 && (
                      <div className="pt-1 border-t border-slate-800/80">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Hướng tiếp cận gợi ý:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                          {cat.suggestedDirections.map((dir, dIdx) => (
                            <li key={dIdx}>{dir}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {cat.cautionNotes && cat.cautionNotes.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                          Lưu ý quan trọng:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90">
                          {cat.cautionNotes.map((note, nIdx) => (
                            <li key={nIdx}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          {/* Missing Criteria Warning if any */}
          {latestAkinatorResult.result.missingCriteria &&
            latestAkinatorResult.result.missingCriteria.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Tiêu chí còn thiếu để đưa ra khuyến nghị đầy đủ:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-0.5">
                  {latestAkinatorResult.result.missingCriteria.map((c, cIdx) => (
                    <li key={cIdx}>
                      <strong>{c.questionText}</strong>: {c.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Disclaimer */}
          <div className="text-[10px] text-slate-500 italic bg-slate-950/40 p-2.5 rounded border border-slate-800/60 leading-relaxed">
            {latestAkinatorResult.result.disclaimerText}
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center space-y-2 bg-slate-900/20">
          <Compass className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-xs font-semibold text-slate-300">
            Khách hàng này chưa có lượt đánh giá Akinator nào hoàn tất
          </div>
          <div className="text-[11px] text-slate-400 max-w-md mx-auto">
            Nhấn nút &quot;Tạo link Akinator gửi khách&quot; để sinh liên kết đánh giá nhu cầu trực tuyến thích ứng dành riêng cho khách hàng này.
          </div>
          <button
            onClick={handleOpenCreateAkinatorModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tạo link Akinator gửi khách ngay</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. AKINATOR: ALL SESSIONS HISTORY TABLE                                   */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-200">
              Lịch sử các phiên làm Akinator ({akinatorSessions.length})
            </h4>
          </div>
          <button
            onClick={handleOpenCreateAkinatorModal}
            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>Tạo link mới</span>
          </button>
        </div>

        {isLoadingAkinator ? (
          <Skeleton className="h-12 w-full rounded-lg bg-slate-800/40" />
        ) : akinatorSessions.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            Chưa có phiên làm Akinator nào được tạo cho khách hàng này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 font-medium">Ngày tạo / Hết hạn</th>
                  <th className="px-3 py-2 font-medium">Phiên bản câu hỏi</th>
                  <th className="px-3 py-2 font-medium">Người tạo link</th>
                  <th className="px-3 py-2 font-medium">Trạng thái phiên</th>
                  <th className="px-3 py-2 font-medium">Tiến độ</th>
                  <th className="px-3 py-2 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-sans">
                {akinatorSessions.map((s) => {
                  const isCompleted = s.quizStatus === 'COMPLETED';
                  const isInProgress = s.quizStatus === 'IN_PROGRESS';
                  const isNotStarted = s.quizStatus === 'NOT_STARTED';
                  const isExpired = s.quizStatus === 'EXPIRED';
                  const isRevoked = s.quizStatus === 'REVOKED';

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <DateDisplay date={s.createdAt} showTime className="text-slate-200 font-mono text-[11px]" />
                        {s.expiresAt && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Hạn: <DateDisplay date={s.expiresAt} showTime />
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-200 text-xs">
                          {s.configVersion?.title || 'Bộ câu hỏi Akinator'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          v{s.configVersion?.versionNumber || 1}
                        </div>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-slate-400 text-xs">
                        {s.createdBy?.fullName || 'Hệ thống'}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Đã hoàn thành</span>
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Clock className="w-2.5 h-2.5 animate-spin" />
                            <span>Đang làm dở</span>
                          </span>
                        )}
                        {isNotStarted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Chưa bắt đầu</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Đã hết hạn</span>
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Đã thu hồi</span>
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {isCompleted ? (
                          <span className="text-emerald-400">Đã trả lời {s.answeredCount} câu</span>
                        ) : s.lastAccessedAt ? (
                          <span>Mở: <DateDisplay date={s.lastAccessedAt} showTime /></span>
                        ) : (
                          <span className="text-slate-600">Chưa mở link</span>
                        )}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCompleted && (
                            <button
                              onClick={() => {
                                if (latestAkinatorResult && latestAkinatorResult.sessionId === s.id) {
                                  setSelectedAkinatorDetail(latestAkinatorResult);
                                  setIsAkinatorDetailOpen(true);
                                } else {
                                  loadAkinatorData();
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" />
                              <span>Xem kết quả</span>
                            </button>
                          )}

                          {(isNotStarted || isInProgress) && (
                            <button
                              onClick={() => handleRevokeAkinatorSession(s.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition-colors"
                              title="Thu hồi link làm Akinator"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Thu hồi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. LEGACY SURVEY SECTION (COLLAPSIBLE, PRESERVED 100%)                     */}
      {/* ========================================================================= */}
      {showLegacySection && (
        <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Khảo sát nhu cầu cũ (Lịch sử: {assessments.length} bài khảo sát • {surveyLinks.length} link)</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Toàn bộ dữ liệu khảo sát cũ trước đây được bảo toàn nguyên vẹn
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreateLinkModal}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700"
              >
                <Share2 className="w-3 h-3" />
                <span>Tạo link gửi khách (Cũ)</span>
              </button>
              <button
                onClick={handleOpenStartModal}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded text-xs font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>Thực hiện khảo sát mới (Cũ)</span>
              </button>
            </div>
          </div>

          {/* Assessments List Table */}
          {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl bg-slate-900/40" />
          <Skeleton className="h-16 w-full rounded-xl bg-slate-900/40" />
        </div>
      ) : assessments.length === 0 ? (
        <div className="p-10 rounded-xl border border-dashed border-slate-800 text-center space-y-3">
          <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-xs text-slate-400">
            Khách hàng này chưa có lượt đánh giá nhu cầu nào
          </div>
          <button
            onClick={handleOpenStartModal}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bắt đầu khảo sát đầu tiên cho khách hàng</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Bộ câu hỏi & Phiên bản</th>
                <th className="px-4 py-3 font-medium">Người thực hiện</th>
                <th className="px-4 py-3 font-medium">Tiến độ câu trả lời</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {assessments.map((item) => {
                const isCompleted = item.status === 'COMPLETED';
                const isCancelled = item.status === 'CANCELLED';

                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DateDisplay date={item.startedAt} showTime className="text-slate-200 font-mono" />
                      {item.completedAt && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Xong: <DateDisplay date={item.completedAt} showTime />
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">
                        {item.questionnaireVersion.questionnaire?.title || item.questionnaireVersion.title || 'Bộ câu hỏi'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
                          v{item.questionnaireVersion.versionNumber}
                        </span>
                        {item.questionnaireVersion.questionnaire?.code && (
                          <span>{item.questionnaireVersion.questionnaire.code}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                      {item.performedBy?.fullName || item.performedBy?.email || 'Hệ thống'}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-300">
                      {item._count?.answers || 0} câu đã trả lời
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đã hoàn thành</span>
                        </span>
                      ) : isCancelled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <XCircle className="w-3 h-3" />
                          <span>Đã hủy</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          <span>Đang thực hiện</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isCompleted && (
                          <button
                            onClick={() =>
                              setRecModalAssessment({
                                id: item.id,
                                title:
                                  item.questionnaireVersion.questionnaire?.title ||
                                  item.questionnaireVersion.title ||
                                  'Bộ câu hỏi',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors"
                            title="Chạy / Xem gợi ý sản phẩm phù hợp cho khảo sát này"
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Gợi ý sản phẩm</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenAssessment(item.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                            isCompleted
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-medium'
                          }`}
                        >
                          {isCompleted ? <Eye className="w-3 h-3 text-blue-400" /> : <FileText className="w-3 h-3" />}
                          <span>{isCompleted ? 'Xem kết quả' : 'Tiếp tục làm bài'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PUBLIC SURVEY LINKS TABLE (KHÁCH HÀNG TỰ PHỤC VỤ)                           */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-slate-200">
              Link khảo sát gửi khách hàng tự điền ({surveyLinks.length})
            </h4>
          </div>
          <button
            onClick={handleOpenCreateLinkModal}
            className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>Tạo link mới</span>
          </button>
        </div>

        {isLoadingLinks ? (
          <Skeleton className="h-12 w-full rounded-lg bg-slate-800/40" />
        ) : surveyLinks.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            Chưa có link khảo sát công khai nào cho khách hàng này. Bấm &quot;Tạo link gửi khách&quot; để gửi khảo sát qua Zalo / tin nhắn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/50 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 font-medium">Ngày tạo / Hết hạn</th>
                  <th className="px-3 py-2 font-medium">Bộ câu hỏi</th>
                  <th className="px-3 py-2 font-medium">Người tạo</th>
                  <th className="px-3 py-2 font-medium">Trạng thái link</th>
                  <th className="px-3 py-2 font-medium">Lần truy cập cuối</th>
                  <th className="px-3 py-2 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-sans">
                {surveyLinks.map((sl) => {
                  const isActive = sl.status === 'ACTIVE';
                  const isCompleted = sl.status === 'COMPLETED';
                  const isRevoked = sl.status === 'REVOKED';
                  const isExpired = sl.status === 'EXPIRED';

                  return (
                    <tr key={sl.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <DateDisplay date={sl.createdAt} showTime className="text-slate-200 font-mono text-[11px]" />
                        <div className="text-[10px] text-slate-500 font-mono">
                          Hạn: <DateDisplay date={sl.expiresAt} showTime />
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-200 text-xs">
                          {sl.assessment?.questionnaireVersion?.questionnaire?.title || 'Bộ câu hỏi'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          v{sl.assessment?.questionnaireVersion?.versionNumber} • {sl.assessment?.questionnaireVersion?.questionnaire?.code}
                        </div>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-slate-400 text-xs">
                        {sl.createdBy?.fullName || 'Nhân viên'}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Globe className="w-2.5 h-2.5" />
                            <span>Đang mở</span>
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Đã điền xong</span>
                          </span>
                        )}
                        {isRevoked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Ban className="w-2.5 h-2.5" />
                            <span>Đã thu hồi</span>
                          </span>
                        )}
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Đã hết hạn</span>
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {sl.lastAccessedAt ? (
                          <DateDisplay date={sl.lastAccessedAt} showTime />
                        ) : (
                          <span className="text-slate-600">Chưa mở</span>
                        )}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCompleted && (
                            <button
                              onClick={() => handleOpenAssessment(sl.assessmentId)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                            >
                              <Eye className="w-3 h-3 text-blue-400" />
                              <span>Xem kết quả</span>
                            </button>
                          )}

                          {isActive && (
                            <button
                              onClick={() => handleRevokeLink(sl.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition-colors"
                              title="Thu hồi link khảo sát ngay lập tức"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Thu hồi</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )}

      {/* ========================================================================= */}
      {/* MODAL 1: BẮT ĐẦU ĐÁNH GIÁ NHU CẦU MỚI (CŨ)                                */}
      {/* ========================================================================= */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <span>Khảo sát nhu cầu: {customerName}</span>
              </h3>
              <button
                onClick={() => setIsStartModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartAssessment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Chọn bộ câu hỏi áp dụng <span className="text-rose-400">*</span>
                </label>
                {availableQuestionnaires.length === 0 ? (
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                    Chưa có bộ câu hỏi nào được xuất bản (PUBLISHED). Vui lòng vào Cài đặt để xuất bản bộ câu hỏi trước.
                  </div>
                ) : (
                  <select
                    value={selectedQuestionnaireId}
                    onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {availableQuestionnaires.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Ghi chú bối cảnh (Tùy chọn)</label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Khách hàng chủ động liên hệ tìm hiểu vay mua ô tô..."
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isStarting || availableQuestionnaires.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm disabled:opacity-50"
                >
                  {isStarting ? 'Đang tạo...' : 'Bắt đầu khảo sát'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1B: TẠO LINK KHẢO SÁT GỬI KHÁCH HÀNG (TỰ PHỤC VỤ)                   */}
      {/* ========================================================================= */}
      {isCreateLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Tạo link khảo sát khách hàng: {customerName}</span>
              </h3>
              <button
                onClick={() => setIsCreateLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdLinkResult ? (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã tạo link khảo sát riêng cho khách hàng!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Khách hàng có thể truy cập link này trên điện thoại hoặc máy tính để tự điền mà không cần đăng nhập CRM. Kết quả sẽ tự động lưu về hồ sơ khách hàng.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Đường link khảo sát</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdLinkResult.url}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-emerald-300 font-mono select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(createdLinkResult.url)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium shadow-sm transition-colors whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Thời hạn sử dụng:</span>
                    <span className="text-slate-200 font-mono">
                      <DateDisplay date={createdLinkResult.expiresAt} showTime /> (7 ngày)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tính năng:</span>
                    <span className="text-slate-300">Tự động lưu tạm nháp • Hoàn tất tức thì</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <a
                    href={createdLinkResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở thử trang khảo sát</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setIsCreateLinkModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSurveyLink} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Chọn bộ câu hỏi áp dụng <span className="text-rose-400">*</span>
                  </label>
                  {availableQuestionnaires.length === 0 ? (
                    <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      Chưa có bộ câu hỏi nào được xuất bản (PUBLISHED).
                    </div>
                  ) : (
                    <select
                      value={linkQuestionnaireId}
                      onChange={(e) => setLinkQuestionnaireId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      {availableQuestionnaires.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.title} ({q.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Ghi chú bối cảnh gửi link (Tùy chọn)</label>
                  <textarea
                    rows={2}
                    placeholder="Ví dụ: Gửi link qua Zalo cho khách hàng tự điền nhu cầu vay vốn..."
                    value={linkNotes}
                    onChange={(e) => setLinkNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Lưu ý bảo mật & vận hành:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    <li>Link được tạo có mã token mã hóa SHA-256 an toàn, không lộ dữ liệu khách hàng khác.</li>
                    <li>Khách hàng có thể lưu tạm tiến trình và quay lại hoàn thành sau.</li>
                    <li>Khi hoàn tất, kết quả tự động cập nhật vào danh sách đánh giá nhu cầu.</li>
                  </ul>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateLinkModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingLink || availableQuestionnaires.length === 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm disabled:opacity-50"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{isCreatingLink ? 'Đang tạo link...' : 'Tạo link khảo sát'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ASSESSMENT RUNNER / INTERACTIVE SURVEY FORM                      */}
      {/* ========================================================================= */}
      {isRunnerOpen && activeAssessment && (
        <AssessmentRunnerModal
          assessment={activeAssessment}
          onClose={() => {
            setIsRunnerOpen(false);
            loadAssessments();
          }}
          onCompleted={() => {
            setIsRunnerOpen(false);
            loadAssessments();
          }}
        />
      )}

      {/* Recommendation Modal (Phase 4) */}
      {recModalAssessment && (
        <AssessmentRecommendationModal
          assessmentId={recModalAssessment.id}
          assessmentTitle={recModalAssessment.title}
          customerName={customerName}
          customerId={customerId}
          isOpen={true}
          onClose={() => setRecModalAssessment(null)}
        />
      )}

      {/* Modal: Tạo Link Akinator Cho Khách Hàng */}
      {isCreateAkinatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Tạo link Akinator: {customerName}</span>
              </h3>
              <button
                onClick={() => setIsCreateAkinatorModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!createdAkinatorLinkResult ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Phiên làm bài trực tuyến thích ứng độc lập</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Hệ thống sẽ tạo một liên kết đánh giá trực tuyến gắn trực tiếp với khách hàng <strong>{customerName}</strong>. Khách hàng thực hiện khảo sát không cần đăng nhập CRM. Khi hoàn thành, toàn bộ câu trả lời và kết quả sẽ tự động lưu vào hồ sơ khách hàng.
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/50 p-3 rounded border border-slate-800">
                  <div>• Mỗi lần nhấn tạo link sẽ sinh một phiên khảo sát mới độc lập.</div>
                  <div>• Link có hiệu lực trong vòng 7 ngày kể từ lúc tạo.</div>
                  <div>• Nhân viên có thể thu hồi link bất kỳ lúc nào nếu chưa hoàn thành.</div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateAkinatorModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingAkinatorLink}
                    onClick={handleCreateAkinatorLink}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors"
                  >
                    {isCreatingAkinatorLink ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang tạo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Xác nhận tạo link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Đã tạo link Akinator thành công!</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Sao chép liên kết dưới đây và gửi cho khách hàng qua Zalo, SMS hoặc Email.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Đường dẫn làm bài của khách:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdAkinatorLinkResult.url}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdAkinatorLinkResult.url);
                        toast.success('Đã sao chép link Akinator vào clipboard!');
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Chép</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Hạn dùng: <DateDisplay date={createdAkinatorLinkResult.expiresAt} showTime />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <a
                    href={createdAkinatorLinkResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở thử link</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsCreateAkinatorModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Chi tiết câu trả lời Akinator */}
      {isAkinatorDetailOpen && selectedAkinatorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Chi tiết đánh giá Akinator: {customerName}</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Hoàn thành: <DateDisplay date={selectedAkinatorDetail.completedAt} showTime className="text-slate-200 font-mono" />
                </div>
              </div>
              <button
                onClick={() => setIsAkinatorDetailOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Result Summary */}
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
              <div className="font-semibold text-emerald-300 text-sm">
                {selectedAkinatorDetail.result.summaryTitle}
              </div>
              <div className="text-xs text-slate-300 leading-relaxed">
                {selectedAkinatorDetail.result.summaryDescription}
              </div>
            </div>

            {/* Answered Questions Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Câu trả lời của khách hàng ({selectedAkinatorDetail.answeredQuestions?.length || 0} câu)
              </h4>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {selectedAkinatorDetail.answeredQuestions?.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1.5"
                  >
                    <div className="text-slate-400 font-medium">
                      Câu {q.stepOrder}: <span className="text-slate-200">{q.questionText}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-3 border-l-2 border-emerald-500/40">
                      <span className="font-semibold text-emerald-400 font-mono">
                        {q.answerLabel || (typeof q.answerValue === 'object' ? JSON.stringify(q.answerValue) : String(q.answerValue))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAkinatorDetailOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: ASSESSMENT RUNNER MODAL
// =========================================================================
interface AssessmentRunnerModalProps {
  assessment: Assessment;
  onClose: () => void;
  onCompleted: () => void;
}

const AssessmentRunnerModal: React.FC<AssessmentRunnerModalProps> = ({
  assessment,
  onClose,
  onCompleted,
}) => {
  const { toast } = useToast();

  const isReadOnly = assessment.status === 'COMPLETED' || assessment.status === 'CANCELLED';
  const questions: QuestionDefinition[] = assessment.questionnaireVersion.questions || [];

  // Initialize answer map from already saved answers
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const a of assessment.answers || []) {
      init[a.questionCode] = a.answerValue;
    }
    return init;
  });

  const [notes, setNotes] = useState<string>(assessment.notes || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleAnswerChange = (code: string, value: any) => {
    if (isReadOnly) return;
    setAnswers((prev) => ({
      ...prev,
      [code]: value,
    }));
    setValidationErrors([]);
  };

  // Evaluate dynamic question visibility based on conditionalLogic
  const isQuestionVisible = (q: QuestionDefinition): boolean => {
    if (!q.conditionalLogic || !q.conditionalLogic.dependsOnQuestionCode) {
      return true;
    }

    const { dependsOnQuestionCode, operator, value } = q.conditionalLogic;
    const sourceAnswer = answers[dependsOnQuestionCode];
    const sourceScalar =
      typeof sourceAnswer === 'object' && sourceAnswer !== null && !Array.isArray(sourceAnswer)
        ? sourceAnswer.value ?? sourceAnswer
        : sourceAnswer;

    switch (operator) {
      case 'EQUALS':
        return String(sourceScalar ?? '') === String(value ?? '');
      case 'NOT_EQUALS':
        return String(sourceScalar ?? '') !== String(value ?? '');
      case 'GREATER_THAN':
        return Number(sourceScalar ?? 0) > Number(value ?? 0);
      case 'LESS_THAN':
        return Number(sourceScalar ?? 0) < Number(value ?? 0);
      case 'IS_EMPTY':
        return sourceScalar === undefined || sourceScalar === null || sourceScalar === '';
      case 'IS_NOT_EMPTY':
        return sourceScalar !== undefined && sourceScalar !== null && sourceScalar !== '';
      default:
        return true;
    }
  };

  // Prepare payload for backend
  const buildAnswerPayload = () => {
    return Object.entries(answers).map(([code, val]) => ({
      questionCode: code,
      answerValue: val,
    }));
  };

  // Save Progress (Draft)
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await assessmentService.saveAnswers(assessment.id, {
        answers: buildAnswerPayload(),
        notes: notes.trim() || null,
      });
      toast.success('Đã lưu tạm câu trả lời thành công');
    } catch (err: any) {
      toast.error('Lỗi khi lưu câu trả lời: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Complete Assessment
  const handleComplete = async () => {
    setIsCompleting(true);
    setValidationErrors([]);
    try {
      await assessmentService.completeAssessment(assessment.id, {
        answers: buildAnswerPayload(),
        notes: notes.trim() || null,
      });
      toast.success('Đã hoàn thành khảo sát nhu cầu! Dữ liệu đã được lưu trữ an toàn.');
      onCompleted();
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Không thể hoàn thành')) {
        setValidationErrors(msg.replace('Không thể hoàn thành khảo sát do còn thiếu hoặc sai thông tin:', '').split(';'));
      } else {
        toast.error('Lỗi khi hoàn thành khảo sát: ' + msg);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl my-8 rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <HelpCircle className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-semibold text-slate-100">
                {assessment.questionnaireVersion.questionnaire?.title || assessment.questionnaireVersion.title || 'Bộ câu hỏi'}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                v{assessment.questionnaireVersion.versionNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Khách hàng: <strong className="text-slate-200">{assessment.customer?.fullName}</strong> · SĐT: {assessment.customer?.phone}
            </p>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-only Banner if Completed */}
        {isReadOnly && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <Lock className="w-4 h-4 shrink-0" />
            <div>
              Khảo sát này đã hoàn thành vào lúc{' '}
              <strong><DateDisplay date={assessment.completedAt || assessment.updatedAt} showTime /></strong>{' '}
              bởi {assessment.performedBy?.fullName || 'Nhân viên phụ trách'}. Dữ liệu đã được khóa bất biến.
            </div>
          </div>
        )}

        {/* Validation Errors Alert */}
        {validationErrors.length > 0 && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>Chưa thể hoàn thành khảo sát do còn các vấn đề sau:</span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {validationErrors.map((err, i) => (
                <li key={i}>{err.trim()}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Questions Body */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {questions.filter((q) => q.active).map((q, idx) => {
            const visible = isQuestionVisible(q);
            if (!visible) return null;

            const currentAnswer = answers[q.code];

            return (
              <div
                key={q.code}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5 transition-all"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-indigo-400 font-mono">
                    Câu {idx + 1}.
                  </span>
                  <div className="text-xs font-semibold text-slate-100">
                    {q.questionText} {q.isRequired && <span className="text-rose-400">*</span>}
                  </div>
                </div>

                {q.description && (
                  <p className="text-[11px] text-slate-400 italic">{q.description}</p>
                )}

                {/* Input renderers */}
                <div className="pt-1">
                  {q.questionType === 'SINGLE_CHOICE' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-center gap-2.5 text-xs text-slate-200 p-2 rounded-lg transition-colors ${
                            isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-900'
                          }`}
                        >
                          <input
                            type="radio"
                            disabled={isReadOnly}
                            name={q.code}
                            value={opt.value}
                            checked={currentAnswer === opt.value}
                            onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                            className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 disabled:opacity-60"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.questionType === 'MULTIPLE_CHOICE' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const arr: string[] = Array.isArray(currentAnswer) ? currentAnswer : [];
                        const isChecked = arr.includes(opt.value);

                        return (
                          <label
                            key={opt.id}
                            className={`flex items-center gap-2.5 text-xs text-slate-200 p-2 rounded-lg transition-colors ${
                              isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-slate-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isReadOnly}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleAnswerChange(q.code, [...arr, opt.value]);
                                } else {
                                  handleAnswerChange(
                                    q.code,
                                    arr.filter((v) => v !== opt.value)
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-700 bg-slate-950 disabled:opacity-60"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.questionType === 'YES_NO' && (
                    <div className="flex items-center gap-6">
                      <label className={`flex items-center gap-2 text-xs text-slate-200 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          disabled={isReadOnly}
                          name={q.code}
                          value="YES"
                          checked={currentAnswer === true || currentAnswer === 'YES'}
                          onChange={() => handleAnswerChange(q.code, true)}
                          className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 disabled:opacity-60"
                        />
                        <span>Có / Đúng</span>
                      </label>
                      <label className={`flex items-center gap-2 text-xs text-slate-200 ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          disabled={isReadOnly}
                          name={q.code}
                          value="NO"
                          checked={currentAnswer === false || currentAnswer === 'NO'}
                          onChange={() => handleAnswerChange(q.code, false)}
                          className="w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 disabled:opacity-60"
                        />
                        <span>Không / Sai</span>
                      </label>
                    </div>
                  )}

                  {q.questionType === 'CURRENCY' && (
                    <div className="space-y-1">
                      <input
                        type="number"
                        disabled={isReadOnly}
                        placeholder="Nhập số tiền VND..."
                        value={currentAnswer ?? ''}
                        onChange={(e) => handleAnswerChange(q.code, e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                      {currentAnswer != null && currentAnswer !== '' && (
                        <div className="text-[11px] text-emerald-400 font-mono">
                          ≈ {Number(currentAnswer).toLocaleString('vi-VN')} ₫
                        </div>
                      )}
                    </div>
                  )}

                  {q.questionType === 'NUMBER' && (
                    <input
                      type="number"
                      disabled={isReadOnly}
                      placeholder="Nhập số lượng..."
                      value={currentAnswer ?? ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  )}

                  {q.questionType === 'TEXT' && (
                    <input
                      type="text"
                      disabled={isReadOnly}
                      placeholder="Nhập câu trả lời..."
                      value={currentAnswer ?? ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  )}

                  {q.questionType === 'LONG_TEXT' && (
                    <textarea
                      rows={3}
                      disabled={isReadOnly}
                      placeholder="Nhập nội dung chi tiết..."
                      value={currentAnswer ?? ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  )}

                  {q.questionType === 'DATE' && (
                    <VietnameseDatePicker
                      variant="dark"
                      size="md"
                      disabled={isReadOnly}
                      value={currentAnswer ?? ''}
                      minDate={q.validationConfig?.minDate}
                      maxDate={q.validationConfig?.maxDate}
                      onChange={(isoDate) => handleAnswerChange(q.code, isoDate || null)}
                      className="max-w-xs"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Survey Notes */}
        <div className="pt-2 border-t border-slate-800">
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Ghi chú đợt khảo sát (tùy chọn)
          </label>
          <textarea
            rows={2}
            disabled={isReadOnly}
            placeholder="Ghi chú thêm về bối cảnh khảo sát, nhu cầu đặc biệt của khách hàng..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
          >
            Đóng
          </button>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu tạm tiến trình'}</span>
              </button>

              <button
                type="button"
                onClick={handleComplete}
                disabled={isCompleting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isCompleting ? 'Đang kiểm tra...' : 'Hoàn thành đánh giá'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
