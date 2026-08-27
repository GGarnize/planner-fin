import type {
  ConfirmCapturedNotificationRequest,
  ListCapturedNotificationsResponse,
  NotificationDeviceResponse,
  PublicCapturedNotification,
  UpdateNotificationDevicePreferencesRequest,
} from '@planner-fin/shared';
import { authenticatedFetch } from './auth';

const messages: Record<string, string> = {
  NOT_FOUND: 'Notificação não encontrada.',
  NOTIFICATION_DEVICE_NOT_FOUND: 'Dispositivo não encontrado.',
  NOTIFICATION_DEVICE_REVOKED: 'Dispositivo desvinculado.',
  RELATED_RESOURCE_ARCHIVED: 'Selecione uma conta e categoria ativas.',
  CATEGORY_TYPE_MISMATCH: 'A categoria não corresponde à natureza do lançamento.',
  NOTIFICATION_ALREADY_CONFIRMED: 'Esta notificação já foi confirmada em um lançamento.',
  NOTIFICATION_ALREADY_DISMISSED: 'Esta notificação já foi descartada.',
  NOTIFICATION_NOT_DISMISSED: 'Somente notificações descartadas podem usar esta ação.',
  PAYMENT_SOURCE_TYPE_MISMATCH: 'Entrada deve ser confirmada em uma conta.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
};

export class NotificationsApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(messages[code] ?? message ?? 'Não foi possível concluir a operação.');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new NotificationsApiError('API_UNAVAILABLE', 'API indisponível. Tente novamente.', 0);
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    const code = response.status === 429 ? 'RATE_LIMITED' : (data.error?.code ?? 'UNKNOWN');
    throw new NotificationsApiError(code, data.error?.message ?? '', response.status);
  }
  return data as T;
}

const json = (method: string, body: object): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const notificationsApi = {
  list(status?: string) {
    return request<ListCapturedNotificationsResponse>(
      `/notifications${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
  },
  get(id: string) {
    return request<PublicCapturedNotification>(`/notifications/${id}`);
  },
  confirm(id: string, body: ConfirmCapturedNotificationRequest) {
    return request<PublicCapturedNotification>(`/notifications/${id}/confirm`, json('POST', body));
  },
  dismiss(id: string) {
    return request<PublicCapturedNotification>(`/notifications/${id}/dismiss`, json('POST', {}));
  },
  restore(id: string) {
    return request<PublicCapturedNotification>(`/notifications/${id}/restore`, json('POST', {}));
  },
  deleteDismissed(id: string) {
    return request<void>(`/notifications/${id}`, { method: 'DELETE' });
  },
  markNonFinancial(id: string) {
    return request<PublicCapturedNotification>(
      `/notifications/${id}/mark-non-financial`,
      json('POST', {}),
    );
  },
  deleteAllHistory() {
    return request<{ purgedCount: number }>('/notifications', { method: 'DELETE' });
  },
  listDevices() {
    return request<NotificationDeviceResponse[]>('/notification-devices');
  },
  updateDevicePreferences(id: string, body: UpdateNotificationDevicePreferencesRequest) {
    return request<NotificationDeviceResponse>(`/notification-devices/${id}`, json('PATCH', body));
  },
};
