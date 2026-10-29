/**
 * AkinatorPage.tsx
 *
 * Dedicated Akinator Tab inside KTEA CRM for ADMIN:
 * - Tab 1: Cấu hình câu hỏi & luật (Question bank, Rule engine, Versioning & Publishing)
 * - Tab 2: Trải nghiệm & Chia sẻ Quiz (Public link sharing, live runner test, module roadmap)
 */
import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  FileCheck2,
  Layers,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sliders,
  Compass,
  FileText,
} from 'lucide-react';
import { akinatorAdminApi } from '../services/akinatorService';
import { formatDate } from '../utils/formatters';
import { AkinatorConfigWorkspace } from '../features/akinator/AkinatorConfigWorkspace';
import { AkinatorSessionsWorkspace } from '../features/akinator/AkinatorSessionsWorkspace';

type AkinatorMainTab = 'sessions' | 'config' | 'overview';

export const AkinatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AkinatorMainTab>('sessions');
  const [currentConfig, setCurrentConfig] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchConfig() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await akinatorAdminApi.getCurrentPublishedConfig();
        if (isMounted) setCurrentConfig(data);
      } catch (err: any) {
        if (isMounted) {
          setError(
            err.message || 'Chưa có phiên bản cấu hình Akinator nào được xuất bản'
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const quizUrl = `${window.location.origin}/akinator/quiz`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(quizUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 font-mono tracking-tight">
              Akinator — Khảo sát & Đánh giá Nhu cầu Thích ứng
            </h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Phân hệ độc lập cho phép quản trị cây câu hỏi thích ứng, thiết lập Rule Engine và theo dõi cấu hình xuất bản.
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Đã chép liên kết</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Sao chép link Quiz</span>
              </>
            )}
          </button>

          <a
            href="/akinator/quiz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition-all"
          >
            <span>Mở giao diện Quiz</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Dữ liệu Akinator (Hồ sơ & Xử lý)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'config'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Cấu hình Akinator (Câu hỏi & Luật)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Tổng quan & Trải nghiệm Quiz</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SESSIONS & WORKFLOW WORKSPACE (PHASE 5) */}
      {/* ========================================================================= */}
      {activeTab === 'sessions' && <AkinatorSessionsWorkspace />}

      {/* ========================================================================= */}
      {/* TAB 2: CONFIGURATION WORKSPACE (PHASE 4) */}
      {/* ========================================================================= */}
      {activeTab === 'config' && <AkinatorConfigWorkspace />}

      {/* ========================================================================= */}
      {/* TAB 3: OVERVIEW & PUBLIC QUIZ RUNNER (PHASE 3) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Public Quiz Launch & Testing */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider font-mono">
                    Luồng làm bài tương tác dành cho Khách hàng
                  </span>
                  <h2 className="text-base font-semibold text-slate-100">
                    Khởi chạy thử nghiệm Quiz thích ứng
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  Đang hoạt động
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Khách hàng truy cập đường link để tham gia làm bài khảo sát thích ứng. Hệ thống tự động chọn câu hỏi kế tiếp theo câu trả lời trước, đánh giá theo Rule Engine và trả về kết quả sơ bộ kèm khuyến cáo tham khảo.
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3 text-xs font-mono">
                <span className="text-slate-400 truncate select-all">{quizUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="text-blue-400 hover:text-blue-300 font-sans flex-shrink-0 text-xs font-medium"
                >
                  {isCopied ? 'Đã sao chép!' : 'Sao chép'}
                </button>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <a
                  href="/akinator/quiz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                >
                  <span>Bắt đầu thử nghiệm Quiz</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Phase 5 Review Queue Roadmap Banner */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Lộ trình tiếp theo (Phase 5 — Hàng đợi Tiếp nhận & Chuyển Khách hàng)</span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Theo kế hoạch phân kỳ, phân hệ tiếp nhận hồ sơ bài làm của khách hàng và quy trình chuyển đổi sẽ được xây dựng tại Phase 5:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg space-y-1">
                  <div className="text-xs font-medium text-slate-200">
                    1. Danh sách hồ sơ quiz
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Xem câu trả lời gốc, kết quả và trạng thái xử lý
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg space-y-1">
                  <div className="text-xs font-medium text-slate-200">
                    2. Chỉnh sửa dữ liệu Admin
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Chuẩn hóa thông tin mà không ghi đè câu trả lời gốc
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg space-y-1">
                  <div className="text-xs font-medium text-slate-200">
                    3. Kiểm tra trùng SĐT
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Cảnh báo trùng và chuyển thủ công sang tab Khách hàng
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Published Configuration Details */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-blue-400" />
                  <span>Cấu hình hiện hành</span>
                </h3>
                {currentConfig && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                    v{currentConfig.versionNumber}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                  <p>Đang tải thông tin cấu hình...</p>
                </div>
              ) : error || !currentConfig ? (
                <div className="py-4 text-xs text-amber-300/90 bg-amber-950/20 border border-amber-900/40 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Chưa có cấu hình xuất bản</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Vui lòng chọn tab "Cấu hình Akinator" để tạo và xuất bản phiên bản cấu hình đầu tiên.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Tiêu đề:</span>
                    <span className="font-medium text-slate-100">{currentConfig.title}</span>
                  </div>

                  {currentConfig.description && (
                    <div>
                      <span className="text-slate-400 text-[11px] block">Mô tả:</span>
                      <span className="text-slate-300">{currentConfig.description}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Số câu hỏi:</span>
                      <span className="font-semibold text-slate-100 text-sm font-mono">
                        {currentConfig.questions?.length || 0}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Số quy tắc:</span>
                      <span className="font-semibold text-slate-100 text-sm font-mono">
                        {currentConfig.rules?.length || 0}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Giới hạn câu hỏi/phiên:</span>
                    <span className="font-medium text-slate-200">
                      {currentConfig.maxQuestionsPerSession || 15} câu
                    </span>
                  </div>

                  {currentConfig.publishedAt && (
                    <div>
                      <span className="text-slate-400 text-[11px] block">Thời điểm xuất bản:</span>
                      <span className="font-mono text-slate-300">
                        {formatDate(currentConfig.publishedAt)}
                      </span>
                    </div>
                  )}

                  {currentConfig.disclaimerText && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-400 text-[11px] block mb-1">
                        Nội dung khuyến cáo tham khảo:
                      </span>
                      <p className="text-[11px] text-slate-400 italic bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                        "{currentConfig.disclaimerText}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AkinatorPage;
