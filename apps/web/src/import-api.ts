import type {
  ImportConfirmResponse,
  ImportPreviewResponse,
  ImportSessionResponse,
} from '@planner-fin/shared';
import { authenticatedFetch } from './auth';

export type ImportFilter = 'all' | 'valid' | 'warning' | 'duplicate' | 'selected';

const messages: Record<string, string> = {
  INVALID_IMPORT_FILE: 'Escolha um arquivo OFX ou CSV válido.',
  IMPORT_FILE_TOO_LARGE: 'O arquivo excede o limite de 10 MiB.',
  UNSUPPORTED_IMPORT_FORMAT: 'Use somente arquivos OFX ou CSV.',
  IMPORT_PARSE_ERROR: 'Não foi possível interpretar o arquivo. Confira o formato e a codificação UTF-8.',
  INVALID_CSV_MAPPING: 'Revise o mapeamento das colunas do CSV.',
  INVALID_IMPORT_ROW: 'Revise os campos obrigatórios desta linha.',
  IMPORT_VERSION_CONFLICT: 'Esta importação foi alterada em outra tela. Recarregamos a versão atual.',
  IMPORT_DRAFT_STALE: 'A revisão mudou. Gere um novo resumo antes de confirmar.',
  IMPORT_ACCOUNT_UNAVAILABLE: 'A conta foi arquivada ou não está mais disponível.',
  IMPORT_CATEGORY_UNAVAILABLE: 'A categoria foi arquivada ou não é compatível.',
  IMPORT_ALREADY_CONFIRMED: 'Esta importação já foi confirmada.',
  IMPORT_READ_ONLY: 'Esta sessão não pode mais ser editada.',
  IMPORT_NOT_FOUND: 'A sessão expirou, foi cancelada ou não está disponível.',
  IDEMPOTENCY_KEY_REUSED: 'A tentativa de confirmação mudou. Gere um novo resumo.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
};

export class ImportApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(messages[code] ?? message ?? 'Não foi possível concluir a operação.');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch(path, init);
  } catch {
    throw new ImportApiError('API_UNAVAILABLE', 'API indisponível. Tente novamente.', 0);
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };
  if (!response.ok) {
    const code = response.status === 429 ? 'RATE_LIMITED' : (data.error?.code ?? 'UNKNOWN');
    throw new ImportApiError(code, data.error?.message ?? '', response.status);
  }
  return data as T;
}

const json = (method: string, body: object): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const importApi = {
  upload(file: File, accountId: string, format: 'OFX' | 'CSV', delimiter = ',') {
    const form = new FormData();
    form.set('file', file);
    form.set('accountId', accountId);
    form.set('format', format);
    if (format === 'CSV') form.set('delimiter', delimiter);
    return request<ImportSessionResponse>('/imports', { method: 'POST', body: form });
  },
  get(id: string, filter: ImportFilter, offset = 0) {
    return request<ImportSessionResponse>(`/imports/${id}?limit=100&offset=${offset}&filter=${filter}`);
  },
  mapping(id: string, draftVersion: number, mapping: object) {
    return request<ImportSessionResponse>(`/imports/${id}/mapping`, json('PUT', { draftVersion, mapping }));
  },
  patchRow(id: string, rowId: string, body: object) {
    return request<ImportSessionResponse>(`/imports/${id}/rows/${rowId}`, json('PATCH', body));
  },
  preview(id: string, draftVersion: number) {
    return request<ImportPreviewResponse>(`/imports/${id}/preview`, json('POST', { draftVersion }));
  },
  confirm(id: string, draftVersion: number, previewToken: string, key: string) {
    const init = json('POST', { draftVersion, previewToken });
    init.headers = { ...init.headers, 'Idempotency-Key': key };
    return request<ImportConfirmResponse>(`/imports/${id}/confirm`, init);
  },
  cancel(id: string, draftVersion: number) {
    return request<void>(`/imports/${id}`, json('DELETE', { draftVersion }));
  },
};
