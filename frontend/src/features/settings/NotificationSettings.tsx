import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Smartphone,
  Laptop,
  Send,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Key,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import notificationService, {
  RegisteredDevice,
  getDeviceName,
} from '../../services/notificationService';

export const NotificationSettings: React.FC = () => {
  const { toast } = useToast();

  const [recipient, setRecipient] = useState<'Ktea' | 'xoaicaldez'>('Ktea');
  const [passkey, setPasskey] = useState<string>(() => {
    return localStorage.getItem('ktea_push_passkey') || '';
  });
  const [deviceName, setDeviceName] = useState<string>(getDeviceName());
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);

  const isPushSupported = notificationService.isPushSupported();
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  // Save passkey to localStorage whenever changed
  useEffect(() => {
    if (passkey) {
      localStorage.setItem('ktea_push_passkey', passkey);
    }
  }, [passkey]);

  // Check current permission and active subscription
  const checkStatus = async () => {
    if (!isPushSupported) return;

    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }

    try {
      const existing = await notificationService.getExistingSubscription();
      setIsSubscribed(!!existing);
    } catch {
      setIsSubscribed(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [recipient]);

  // Load devices for the selected recipient
  const loadDevices = async () => {
    if (!passkey.trim()) return;
    setIsLoadingDevices(true);
    try {
      const list = await notificationService.getSubscriptions(recipient, passkey);
      setDevices(list || []);
    } catch {
      // Ignored if passkey invalid yet
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (passkey.trim()) {
      loadDevices();
    }
  }, [recipient, passkey]);

  // Handle subscribe device
  const handleSubscribe = async () => {
    if (!passkey.trim()) {
      toast.warning('Thiếu mã kích hoạt', 'Vui lòng nhập Mã kích hoạt (Passkey) để bảo mật thiết bị.');
      return;
    }

    setIsLoading(true);
    try {
      await notificationService.subscribeDevice(recipient, passkey, deviceName);
      await checkStatus();
      await loadDevices();
      toast.success(
        'Bật thông báo thành công!',
        `Thiết bị "${deviceName}" đã được kích hoạt nhận thông báo cho ${recipient}.`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(
        'Không thể kích hoạt thông báo',
        err?.message || 'Vui lòng kiểm tra quyền thông báo trên trình duyệt hoặc mã bảo mật.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle unsubscribe current device
  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      await notificationService.unsubscribeDevice();
      await checkStatus();
      await loadDevices();
      toast.info(
        'Đã hủy nhận thông báo',
        'Thiết bị này sẽ không còn nhận thông báo từ KTEA CRM.'
      );
    } catch (err: any) {
      toast.error(
        'Lỗi khi hủy đăng ký',
        err?.message || 'Không thể hủy đăng ký thiết bị.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle test push
  const handleTestPush = async () => {
    if (!passkey.trim()) {
      toast.warning('Thiếu mã kích hoạt', 'Vui lòng nhập Mã kích hoạt trước khi gửi thử nghiệm.');
      return;
    }

    setIsTesting(true);
    try {
      await notificationService.sendTestPush(recipient, passkey);
      toast.success(
        'Đã phát tín hiệu thử nghiệm',
        `Thông báo thử nghiệm đã được gửi đến các thiết bị của ${recipient}.`
      );
    } catch (err: any) {
      toast.error(
        'Lỗi gửi thông báo thử nghiệm',
        err?.message || 'Không thể gửi thông báo test.'
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert for iOS without PWA */}
      {isIOS && !isStandalone && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-amber-300">Hướng dẫn kích hoạt trên iPhone / iPad (iOS 16.4+):</p>
              <p>
                Hệ điều hành iOS bắt buộc phải cài đặt ứng dụng vào màn hình chính trước khi nhận Web Push:
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-amber-200/90 pl-1">
                <li>Nhấn nút <strong>Chia sẻ (Share icon <ExternalLink className="inline h-3 w-3" />)</strong> ở thanh dưới Safari.</li>
                <li>Chọn <strong>"Thêm vào MH chính" (Add to Home Screen)</strong>.</li>
                <li>Mở icon <strong>KTEA CRM</strong> từ màn hình chính vừa tạo.</li>
                <li>Vào lại trang này và nhấn nút <strong>"Bật thông báo trên thiết bị này"</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Unsupported browser warning */}
      {!isPushSupported && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-red-300">Trình duyệt không hỗ trợ Web Push:</p>
              <p className="text-xs text-red-200/90">
                Trình duyệt này không hỗ trợ Web Push Notification API hoặc trang web đang chạy qua giao thức không phải HTTPS an toàn.
                Vui lòng sử dụng Google Chrome, Edge hoặc Safari (iOS 16.4+ thêm vào Màn hình chính).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur shadow-xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <BellRing className="h-5 w-5 text-blue-400" />
            Cấu hình Thông báo đẩy (Web Push Notifications)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Nhận thông báo tức thì khi có lịch chăm sóc mới và nhắc hẹn trước giờ chăm sóc 30 phút.
          </p>
        </div>

        {/* 1. Recipient Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            1. Chọn người chăm sóc nhận thông báo:
          </label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {(['Ktea', 'xoaicaldez'] as const).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setRecipient(name)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  recipient === name
                    ? 'border-blue-500 bg-blue-500/20 text-blue-200 shadow-lg shadow-blue-500/10'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    recipient === name ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Device Name & Passkey */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Laptop className="h-3.5 w-3.5 text-slate-400" />
              Tên thiết bị này (Gợi nhớ)
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="VD: iPhone 15 của Ktea"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950/70 text-slate-100 text-sm focus:border-blue-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-amber-400" />
              Mã kích hoạt bảo mật (Passkey)
            </label>
            <input
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              placeholder="Nhập mã bảo mật kích hoạt"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950/70 text-slate-100 text-sm focus:border-blue-500 focus:outline-none transition-all font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Mã được lưu an toàn trong thiết bị này để không phải nhập lại.
            </p>
          </div>
        </div>

        {/* 3. Status Badges */}
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Trạng thái thiết bị hiện tại:
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Permission status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-xs">
              <span className="text-slate-400">Quyền trình duyệt:</span>
              {permissionState === 'granted' ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đã cấp quyền
                </span>
              ) : permissionState === 'denied' ? (
                <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> Đã chặn (Cần mở lại trong cài đặt web)
                </span>
              ) : (
                <span className="text-amber-400 font-medium">Chưa yêu cầu</span>
              )}
            </div>

            {/* Push status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-xs">
              <span className="text-slate-400">Trạng thái nhận đẩy:</span>
              {isSubscribed ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đang hoạt động
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                  <BellOff className="h-3.5 w-3.5" /> Chưa bật trên máy này
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!isSubscribed ? (
            <Button
              type="button"
              onClick={handleSubscribe}
              disabled={isLoading || !isPushSupported}
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20"
            >
              <Bell className="h-4 w-4" />
              {isLoading ? 'Đang kích hoạt...' : 'Bật thông báo trên thiết bị này'}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleTestPush}
                disabled={isTesting}
                variant="outline"
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center gap-2 px-4 py-2 rounded-xl"
              >
                <Send className="h-4 w-4 text-blue-400" />
                {isTesting ? 'Đang gửi test...' : 'Gửi thông báo thử nghiệm'}
              </Button>

              <Button
                type="button"
                onClick={handleUnsubscribe}
                disabled={isLoading}
                variant="outline"
                className="border-red-900/50 bg-red-950/20 hover:bg-red-900/40 text-red-300 flex items-center gap-2 px-4 py-2 rounded-xl"
              >
                <BellOff className="h-4 w-4 text-red-400" />
                {isLoading ? 'Đang xử lý...' : 'Hủy đăng ký thiết bị này'}
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              checkStatus();
              loadDevices();
            }}
            className="text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Làm mới
          </Button>
        </div>

        {/* 5. Registered Devices List */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-400" />
              Danh sách thiết bị đã đăng ký của {recipient} ({devices.length})
            </h3>
          </div>

          {isLoadingDevices ? (
            <div className="text-xs text-slate-500 py-3">Đang tải danh sách thiết bị...</div>
          ) : devices.length === 0 ? (
            <div className="text-xs text-slate-500 py-3 bg-slate-950/30 rounded-xl px-4 border border-slate-800/60">
              Chưa có thiết bị nào được kích hoạt cho {recipient}. Hãy nhấn nút bật thông báo ở trên.
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/50 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div>
                      <p className="font-medium text-slate-200">{d.deviceName || 'Thiết bị không tên'}</p>
                      <p className="text-[11px] text-slate-500">
                        Đăng ký lúc: {new Date(d.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Sẵn sàng
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instructions Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-400" />
          Hướng dẫn & Lưu ý khi nhận thông báo trên điện thoại
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="space-y-1.5 p-3.5 rounded-xl border border-slate-800/60 bg-slate-950/40">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              📱 Dành cho iPhone / iPad (iOS 16.4+):
            </p>
            <p>1. Bắt buộc mở Safari truy cập web KTEA CRM.</p>
            <p>2. Nhấn nút <strong>Chia sẻ (Share)</strong> ➜ Chọn <strong>"Thêm vào Màn hình chính" (Add to Home Screen)</strong>.</p>
            <p>3. Mở ứng dụng từ màn hình chính, vào mục Cài đặt thông báo này và nhấn <strong>Bật thông báo</strong>.</p>
            <p>4. Kiểm tra trong Cài đặt iPhone ➜ Thông báo ➜ KTEA CRM ➜ Bật cho phép thông báo.</p>
          </div>

          <div className="space-y-1.5 p-3.5 rounded-xl border border-slate-800/60 bg-slate-950/40">
            <p className="font-semibold text-slate-300 flex items-center gap-1.5">
              🤖 Dành cho Android (Google Chrome / Brave):
            </p>
            <p>1. Mở Chrome truy cập web KTEA CRM qua HTTPS.</p>
            <p>2. Nhấn nút <strong>Bật thông báo trên thiết bị này</strong> và chọn <strong>"Cho phép" (Allow)</strong>.</p>
            <p>3. Nếu thông báo bị chậm, hãy vào Cài đặt điện thoại ➜ Ứng dụng Chrome ➜ Pin ➜ Chọn <strong>"Không hạn chế" (Unrestricted)</strong>.</p>
            <p>4. Có thể cài đặt thành app bằng cách bấm menu ⋮ ➜ <strong>Cài đặt ứng dụng</strong>.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
