export interface HealthResponse {
  status: 'ok';
  service: 'planner-fin-api';
}

export const HEALTH_RESPONSE: HealthResponse = {
  status: 'ok',
  service: 'planner-fin-api',
};

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type UserAppearance = 'SYSTEM' | 'LIGHT' | 'DARK';
export type UserAccent = 'BLUE' | 'TEAL' | 'PURPLE' | 'ORANGE';
export interface UserPreferencesResponse {
  appearance: UserAppearance;
  accent: UserAccent;
  updatedAt: string;
}
export interface UpdateUserPreferencesRequest {
  appearance?: UserAppearance;
  accent?: UserAccent;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface AuthResponse {
  accessToken: string;
  csrfToken: string;
  expiresIn: 900;
  user: PublicUser;
}
export interface ApiErrorResponse {
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

export type ImportFormat = 'OFX' | 'CSV';
export type ImportStatus =
  | 'UPLOADED'
  | 'MAPPING_REQUIRED'
  | 'READY_FOR_REVIEW'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';
export type ImportDuplicateClassification = 'NONE' | 'STRONG' | 'PROBABLE' | 'POSSIBLE';
export interface ImportRowResponse {
  id: string;
  rowNumber: number;
  date: string | null;
  description: string | null;
  type: FinancialTransactionType | null;
  amount: string | null;
  categoryId: string | null;
  selected: boolean;
  validationStatus: 'VALID' | 'BLOCKED';
  warnings: string[];
  duplicateClassification: ImportDuplicateClassification;
  probableOverride: boolean;
  possibleAccepted: boolean;
}
export interface ImportPreviewResponse {
  previewToken: string;
  previewHash: string;
  draftVersion: number;
  counts: {
    total: number;
    selected: number;
    blocked: number;
    strong: number;
    probable: number;
    possible: number;
  };
  totals: { income: string; expense: string };
}
export interface ImportConfirmResponse {
  status: 'CONFIRMED';
  sessionId: string;
  transactionIds: string[];
  createdCount: number;
}
export interface ImportSessionResponse {
  id: string;
  accountId: string;
  format: ImportFormat;
  status: ImportStatus;
  draftVersion: number;
  displayFileName: string | null;
  rowCount: number;
  expiresAt: string;
  mapping: Record<string, unknown> | null;
  csvSample?: CsvSample;
  rows: ImportRowResponse[];
  page: { limit: number; offset: number; filteredCount: number };
}
export interface CsvSample {
  columns: Array<{ index: number; header: string; samples: string[] }>;
  rowCount: number;
}
export interface OpenImportSessionResponse {
  id: string;
  format: ImportFormat;
  status: 'UPLOADED' | 'MAPPING_REQUIRED' | 'READY_FOR_REVIEW';
  accountId: string;
  displayFileName: string | null;
  draftVersion: number;
  updatedAt: string;
  expiresAt: string;
}
export type ImportErrorCode =
  | 'INVALID_IMPORT_FILE'
  | 'IMPORT_FILE_TOO_LARGE'
  | 'UNSUPPORTED_IMPORT_FORMAT'
  | 'IMPORT_PARSE_ERROR'
  | 'IMPORT_NOT_FOUND'
  | 'INVALID_CSV_MAPPING'
  | 'INVALID_IMPORT_ROW'
  | 'IMPORT_VERSION_CONFLICT'
  | 'IMPORT_DRAFT_STALE'
  | 'IMPORT_NOT_READY'
  | 'IMPORT_NOT_CONFIRMABLE'
  | 'IMPORT_ACCOUNT_UNAVAILABLE'
  | 'IMPORT_CATEGORY_UNAVAILABLE'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IMPORT_ALREADY_CONFIRMED'
  | 'IMPORT_READ_ONLY';

export interface NotificationDeviceResponse {
  id: string;
  deviceId: string;
  ownerBindingId: string;
  name: string | null;
  status: 'ACTIVE' | 'REVOKED';
  captureEnabled: boolean;
  monitoredPackages: string[];
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface BindNotificationDeviceRequest {
  deviceId: string;
  name?: string | null;
  captureEnabled?: boolean;
  monitoredPackages?: string[];
  replacePreferences?: boolean;
}
export interface UpdateNotificationDevicePreferencesRequest {
  captureEnabled?: boolean;
  monitoredPackages?: string[];
}
export interface CapturedNotificationIngestItem {
  localId: string;
  packageName: string;
  notificationKeyHash: string;
  postedAt: string;
  capturedAt: string;
  title?: string | null;
  text?: string | null;
  subText?: string | null;
  bigText?: string | null;
  fingerprintVersion: 1;
}
export interface IngestCapturedNotificationsRequest {
  deviceId: string;
  ownerBindingId: string;
  items: CapturedNotificationIngestItem[];
}
export interface IngestCapturedNotificationsResponse {
  acceptedLocalIds: string[];
  duplicateLocalIds: string[];
  createdCount: number;
  duplicateCount: number;
}
export type CapturedNotificationStatus =
  | 'UNCLASSIFIED'
  | 'FINANCIAL_CANDIDATE'
  | 'NON_FINANCIAL'
  | 'AMBIGUOUS'
  | 'IGNORED'
  | 'DISMISSED'
  | 'CONFIRMED';
export interface PublicCapturedNotification {
  id: string;
  deviceId: string;
  packageName: string;
  status: CapturedNotificationStatus;
  postedAt: string;
  receivedAt: string;
  title: string | null;
  text: string | null;
  subText: string | null;
  bigText: string | null;
  parsedType: 'INCOME' | 'EXPENSE' | null;
  parsedAmount: string | null;
  parsedDescription: string | null;
  parsedCardLast4: string | null;
  classificationReasons: string[];
  classifiedAt: string | null;
  accountId: string | null;
  cardId: string | null;
  categoryId: string | null;
  confirmedTransactionId: string | null;
  confirmedCardPurchaseId: string | null;
  confirmedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CapturedNotificationListQuery {
  status?: CapturedNotificationStatus;
  limit?: string;
  offset?: string;
}
export interface ListCapturedNotificationsResponse {
  data: PublicCapturedNotification[];
  page: { limit: number; offset: number; filteredCount: number };
}
export interface ConfirmCapturedNotificationRequest {
  paymentSourceType?: 'ACCOUNT' | 'CARD';
  accountId?: string;
  cardId?: string;
  categoryId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string;
  date: string;
  installmentCount?: number;
}
export type NotificationReviewErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'RELATED_RESOURCE_ARCHIVED'
  | 'NOTIFICATION_ALREADY_DISMISSED'
  | 'NOTIFICATION_ALREADY_CONFIRMED'
  | 'NOTIFICATION_NOT_DISMISSED'
  | 'INTERNAL_ERROR';

export type FinancialAccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'PAYMENT' | 'OTHER';
export interface PublicFinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  institution: string | null;
  currency: 'BRL';
  openingBalance: string;
  realizedBalance: string | null;
  openingBalanceDate: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateFinancialAccountRequest {
  name: string;
  type: FinancialAccountType;
  institution?: string | null;
  currency: 'BRL';
  openingBalance: string;
  openingBalanceDate: string;
}
export type UpdateFinancialAccountRequest = Partial<CreateFinancialAccountRequest>;
export type ListFinancialAccountsResponse = PublicFinancialAccount[];

export type FinancialCategoryType = 'INCOME' | 'EXPENSE';
export type FinancialCategoryIcon =
  | 'HOME'
  | 'WORK'
  | 'SHOPPING_CART'
  | 'RESTAURANT'
  | 'DIRECTIONS_CAR'
  | 'HEALTH_AND_SAFETY'
  | 'SCHOOL'
  | 'SAVINGS';
export interface PublicFinancialCategory {
  id: string;
  name: string;
  type: FinancialCategoryType;
  color: string | null;
  icon: FinancialCategoryIcon | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateFinancialCategoryRequest {
  name: string;
  type: FinancialCategoryType;
  color?: string | null;
  icon?: FinancialCategoryIcon | null;
}
export interface UpdateFinancialCategoryRequest {
  name?: string;
  color?: string | null;
  icon?: FinancialCategoryIcon | null;
}
export type ListFinancialCategoriesResponse = PublicFinancialCategory[];

export type InitialSetupStatus = 'NOT_STARTED' | 'SKIPPED' | 'COMPLETED';
export type InitialSetupIneligibleReason =
  'NOT_IN_ROLLOUT' | 'HAS_FINANCIAL_DATA' | 'SETUP_SKIPPED' | 'SETUP_COMPLETED';
export interface InitialSetupCategoryDraft {
  key: string;
  name: string;
  type: FinancialCategoryType;
  icon: FinancialCategoryIcon;
  selected: boolean;
}
export interface InitialSetupDraft {
  step: 'INTRO' | 'ACCOUNT' | 'CATEGORIES' | 'REVIEW';
  account: {
    name: string;
    type: FinancialAccountType;
    openingBalance?: string | null;
    openingBalanceDate: string;
  };
  categories: InitialSetupCategoryDraft[];
}
export type InitialSetupSuggestion = InitialSetupCategoryDraft;
export interface InitialSetupStateResponse {
  participating: boolean;
  eligible: boolean;
  status: InitialSetupStatus | null;
  ineligibleReason: InitialSetupIneligibleReason | null;
  draft: InitialSetupDraft | null;
  draftVersion: number | null;
  suggestionVersion: number;
  suggestions: InitialSetupSuggestion[];
  lastValidStep: InitialSetupDraft['step'];
}
export interface SaveInitialSetupDraftRequest {
  expectedDraftVersion: number | null;
  draft: InitialSetupDraft;
}
export interface InitialSetupPreviewRequest {
  draftVersion: number;
}
export interface InitialSetupPreviewResponse {
  previewToken: string;
  draftVersion: number;
  summary: {
    account: {
      name: string;
      type: FinancialAccountType;
      currency: 'BRL';
      institution: null;
      openingBalance: string;
      openingBalanceDate: string;
    };
    categories: Array<{
      name: string;
      type: FinancialCategoryType;
      icon: FinancialCategoryIcon;
      color: null;
    }>;
    counts: { accounts: 1; categories: number; transactions: 0; recurrences: 0; total: number };
  };
}
export interface InitialSetupConfirmResponse {
  status: 'COMPLETED';
  created: { accountId: string; categoryIds: string[] };
  counts: { accounts: 1; categories: number; transactions: 0; recurrences: 0; total: number };
}
export interface InitialSetupSkipResponse {
  status: 'SKIPPED';
}

export type FinancialTransactionType = 'INCOME' | 'EXPENSE';
export type TransactionTemplateType = FinancialTransactionType;
export interface CreateTransactionTemplateRequest {
  name: string;
  type: TransactionTemplateType;
  categoryId: string;
  description: string;
  plannedAmount: string;
  defaultAccountId?: string | null;
  notes?: string | null;
  dueDay?: number | null;
}
export type UpdateTransactionTemplateRequest = Partial<CreateTransactionTemplateRequest>;
export interface PublicTransactionTemplate {
  id: string;
  name: string;
  type: TransactionTemplateType;
  categoryId: string;
  categoryAvailable: boolean;
  description: string;
  plannedAmount: string;
  defaultAccountId: string | null;
  defaultAccountAvailable: boolean;
  notes: string | null;
  dueDay: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TransactionTemplateListQuery {
  type?: TransactionTemplateType;
  includeArchived?: boolean;
  q?: string;
}
export type ListTransactionTemplatesResponse = PublicTransactionTemplate[];
export type TransactionTemplateErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'TEMPLATE_NOT_FOUND'
  | 'RELATED_RESOURCE_NOT_FOUND'
  | 'TEMPLATE_NAME_CONFLICT'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'RELATED_RESOURCE_ARCHIVED'
  | 'TEMPLATE_ARCHIVED'
  | 'INTERNAL_ERROR';
export type FinancialTransactionStatus = 'PENDING' | 'PAID';
export interface PublicFinancialTransaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  description: string;
  notes: string | null;
  plannedAmount: string;
  actualAmount: string | null;
  dueDate: string;
  paidAt: string | null;
  isOverdue: boolean;
  isRecurringOccurrence: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateFinancialTransactionRequest {
  accountId: string;
  categoryId: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  description: string;
  notes?: string | null;
  plannedAmount: string;
  actualAmount?: string | null;
  dueDate: string;
  paidAt?: string | null;
}
export interface UpdateFinancialTransactionRequest {
  description?: string;
  notes?: string | null;
  plannedAmount?: string;
  dueDate?: string;
  accountId?: string;
  categoryId?: string;
  type?: FinancialTransactionType;
}
export interface PayFinancialTransactionRequest {
  actualAmount: string;
  paidAt: string;
}
export interface TransactionListQuery {
  accountId?: string;
  categoryId?: string;
  type?: FinancialTransactionType;
  status?: FinancialTransactionStatus;
  dueDateFrom?: string;
  dueDateTo?: string;
  paidAtFrom?: string;
  paidAtTo?: string;
  limit?: string;
  cursor?: string;
}
export interface PaginatedFinancialTransactionsResponse {
  data: PublicFinancialTransaction[];
  page: { limit: number; nextCursor: string | null };
}
export type FinancialTransactionErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CURSOR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'RELATED_RESOURCE_ARCHIVED'
  | 'TRANSACTION_ALREADY_PAID'
  | 'PAID_TRANSACTION_REQUIRES_REOPEN'
  | 'INTERNAL_ERROR';

/**
 * Feed somente-leitura que une FinancialTransaction (lançamentos de conta) e
 * CardPurchase (compras no cartão) numa única lista ordenada por data, para a
 * tela de Lançamentos. Cada fonte mantém seu modelo de escrita próprio
 * (POST /transactions, POST /card-purchases) — este feed não cria uma terceira
 * entidade, só combina leitura.
 *
 * Lançamentos: o que foi registrado/comprado.
 * Agregados mensais: quanto da despesa pertence a cada período.
 */
export type FinancialEntrySource = 'TRANSACTION' | 'CARD_PURCHASE';
export interface PublicFinancialEntry {
  /** Chave estável para a UI: `${source}:${sourceId}`. */
  id: string;
  source: FinancialEntrySource;
  /** id do FinancialTransaction ou do CardPurchase de origem. */
  sourceId: string;
  type: FinancialTransactionType;
  description: string;
  notes: string | null;
  /**
   * Data usada para ordenar/agrupar (Hoje/Futuros/Anteriores): dueDate do
   * lançamento, ou purchaseDate da compra no cartão.
   */
  date: string;
  /** Valor já resolvido: realizado quando pago, previsto quando pendente; totalAmount da compra no cartão. */
  amount: string;
  categoryId: string;
  /** null para CARD_PURCHASE — compra de cartão não tem estado pago/pendente próprio. */
  status: FinancialTransactionStatus | null;
  /** null para CARD_PURCHASE — compra de cartão não está ligada a uma conta. */
  accountId: string | null;
  cardId: string | null;
  cardName: string | null;
  /** id do CardPurchase, para editar/excluir a compra de origem. null para TRANSACTION. */
  purchaseId: string | null;
  /** null no feed principal; numeração de parcelas pertence à fatura/detalhe. */
  installmentNumber: number | null;
  installmentCount: number | null;
  overdue: boolean;
  /** true só para TRANSACTION gerado por recorrência; sempre false para CARD_PURCHASE. */
  isRecurringOccurrence: boolean;
  createdAt: string;
}
export interface FinancialEntryListQuery {
  accountId?: string;
  categoryId?: string;
  type?: FinancialTransactionType;
  status?: FinancialTransactionStatus;
  dueDateFrom?: string;
  dueDateTo?: string;
  paidAtFrom?: string;
  paidAtTo?: string;
  limit?: string;
  cursor?: string;
}
export interface PaginatedFinancialEntriesResponse {
  data: PublicFinancialEntry[];
  page: { limit: number; nextCursor: string | null };
}

export type FinancialTransferStatus = 'PENDING' | 'COMPLETED';
export interface PublicFinancialTransfer {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  status: FinancialTransferStatus;
  description: string;
  notes: string | null;
  plannedAmount: string;
  actualAmount: string | null;
  dueDate: string;
  completedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateFinancialTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  status: FinancialTransferStatus;
  description: string;
  notes?: string | null;
  plannedAmount: string;
  actualAmount?: string | null;
  dueDate: string;
  completedAt?: string | null;
}
export interface UpdateFinancialTransferRequest {
  description?: string;
  notes?: string | null;
  plannedAmount?: string;
  dueDate?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
}
export interface CompleteFinancialTransferRequest {
  actualAmount: string;
  completedAt: string;
}
export interface TransferListQuery {
  sourceAccountId?: string;
  destinationAccountId?: string;
  accountId?: string;
  status?: FinancialTransferStatus;
  dueDateFrom?: string;
  dueDateTo?: string;
  completedAtFrom?: string;
  completedAtTo?: string;
  limit?: string;
  cursor?: string;
}
export interface PaginatedFinancialTransfersResponse {
  data: PublicFinancialTransfer[];
  page: { limit: number; nextCursor: string | null };
}
export type FinancialTransferErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CURSOR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RELATED_ACCOUNT_ARCHIVED'
  | 'TRANSFER_ALREADY_COMPLETED'
  | 'COMPLETED_TRANSFER_REQUIRES_REOPEN'
  | 'CONCURRENT_MODIFICATION'
  | 'INTERNAL_ERROR';

export type RecurrenceKind = 'TRANSACTION' | 'TRANSFER';
export type RecurrenceStatus = 'ACTIVE' | 'PAUSED';
export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurrenceAttentionStatus = 'READY' | 'BLOCKED';
export type RecurrenceCalendar =
  | { frequency: 'WEEKLY'; dayOfWeek: number }
  | { frequency: 'MONTHLY'; dayOfMonth: number }
  | { frequency: 'YEARLY'; monthOfYear: number; dayOfMonth: number };
export type RecurrenceTemplate =
  | {
      kind: 'TRANSACTION';
      transactionType: FinancialTransactionType;
      accountId: string;
      categoryId: string;
      plannedAmount: string;
      description: string;
      notes?: string | null;
    }
  | {
      kind: 'TRANSFER';
      sourceAccountId: string;
      destinationAccountId: string;
      plannedAmount: string;
      description: string;
      notes?: string | null;
    };
export type CreateRecurrenceRequest = RecurrenceCalendar &
  RecurrenceTemplate & {
    startDate: string;
    endDate?: string | null;
  };
export type UpdateRecurrenceRequest = Partial<Omit<CreateRecurrenceRequest, 'kind'>>;
export type PublicRecurrence = CreateRecurrenceRequest & {
  id: string;
  status: RecurrenceStatus;
  nextOccurrenceDate: string | null;
  attentionStatus: RecurrenceAttentionStatus;
  blockedReason: 'RELATED_RESOURCE_ARCHIVED' | null;
  blockedResourceType: 'ACCOUNT' | 'CATEGORY' | null;
  blockedResourceId: string | null;
  blockedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export interface RecurrenceListQuery {
  kind?: RecurrenceKind;
  status?: RecurrenceStatus;
  frequency?: RecurrenceFrequency;
  includeArchived?: boolean;
}
export interface GenerateRecurrenceResponse {
  generatedCount: number;
  throughDate: string;
  nextOccurrenceDate: string | null;
}

export type CardInvoiceStatus = 'OPEN' | 'CLOSED' | 'PAID';
export interface PublicFinancialCreditCard {
  id: string;
  name: string;
  issuer: string | null;
  last4: string | null;
  creditLimit: string | null;
  closingDay: number;
  dueDay: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CreateFinancialCreditCardRequest {
  name: string;
  issuer?: string | null;
  last4?: string | null;
  creditLimit?: string | null;
  closingDay: number;
  dueDay: number;
}
export type UpdateFinancialCreditCardRequest = Partial<CreateFinancialCreditCardRequest>;
export interface PublicCardInstallment {
  id: string;
  installmentNumber: number;
  installmentCount: number;
  amount: string;
  referenceMonth: string;
  invoiceId: string;
  createdAt: string;
}
export interface PublicCardPurchase {
  id: string;
  cardId: string;
  categoryId: string;
  description: string;
  notes: string | null;
  purchaseDate: string;
  totalAmount: string;
  installmentCount: number;
  installments: PublicCardInstallment[];
  createdAt: string;
  updatedAt: string;
}
export interface CreateCardPurchaseRequest {
  cardId: string;
  categoryId: string;
  description: string;
  notes?: string | null;
  purchaseDate: string;
  totalAmount: string;
  installmentCount: number;
}
export type UpdateCardPurchaseRequest = Partial<CreateCardPurchaseRequest>;
export interface CardPurchaseListQuery {
  cardId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: string;
  cursor?: string;
}
export interface PaginatedCardPurchasesResponse {
  items: PublicCardPurchase[];
  nextCursor: string | null;
}
export interface PublicCardInvoicePayment {
  id: string;
  invoiceId: string;
  accountId: string;
  amount: string;
  paymentDate: string;
  createdAt: string;
}
export interface PublicCardInvoice {
  id: string;
  cardId: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  status: CardInvoiceStatus;
  closedAt: string | null;
  paidAt: string | null;
  total: string;
  installments: Array<
    PublicCardInstallment & { purchaseId: string; purchaseDescription: string; categoryId: string }
  >;
  payment: PublicCardInvoicePayment | null;
  createdAt: string;
  updatedAt: string;
}
export interface CardInvoiceListQuery {
  cardId?: string;
  status?: CardInvoiceStatus;
  cycleFrom?: string;
  cycleTo?: string;
  limit?: string;
  cursor?: string;
}
export interface PaginatedCardInvoicesResponse {
  items: PublicCardInvoice[];
  nextCursor: string | null;
}
export interface PayCardInvoiceRequest {
  accountId: string;
  paymentDate: string;
}
export type CardErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CURSOR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RELATED_RESOURCE_ARCHIVED'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'INVOICE_NOT_CLOSED'
  | 'INVOICE_ALREADY_PAID'
  | 'PURCHASE_IN_CLOSED_INVOICE'
  | 'CONCURRENT_MODIFICATION'
  | 'INTERNAL_ERROR';

export type DebtType = 'LOAN' | 'FINANCING' | 'NEGOTIATED_DEBT' | 'OTHER';
export type DebtStatus = 'ACTIVE' | 'PAID_OFF';
export type DebtInstallmentStatus = 'PENDING' | 'PAID';
export type DebtInstallmentProjectedStatus = 'PENDING' | 'OVERDUE' | 'PAID';
export interface PublicDebtInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
  totalAmount: string;
  status: DebtInstallmentStatus;
  projectedStatus: DebtInstallmentProjectedStatus;
  createdAt: string;
  updatedAt: string;
}
export interface PublicDebtFunding {
  id: string;
  accountId: string;
  amount: string;
  fundingDate: string;
  createdAt: string;
}
export interface PublicDebtPayment {
  id: string;
  debtId: string;
  installmentId: string;
  accountId: string;
  paymentDate: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
  totalAmount: string;
  createdAt: string;
}
export interface DebtProjections {
  outstandingPrincipal: string;
  paidPrincipal: string;
  paidInterestAmount: string;
  paidFeeAmount: string;
  pendingInterestAmount: string;
  pendingFeeAmount: string;
  totalFutureAmount: string;
  paidInstallmentCount: number;
  pendingInstallmentCount: number;
  overdueInstallmentCount: number;
  nextInstallment: PublicDebtInstallment | null;
  projectedStatus: DebtStatus;
}
export interface PublicFinancialDebt {
  id: string;
  type: DebtType;
  creditorName: string;
  description: string;
  notes: string | null;
  originalPrincipal: string;
  startDate: string;
  installmentCount: number;
  status: DebtStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  projections: DebtProjections;
}
export interface FinancialDebtDetail extends PublicFinancialDebt {
  funding: PublicDebtFunding | null;
  installments: PublicDebtInstallment[];
  payments: PublicDebtPayment[];
}
export interface DebtInstallmentInput {
  installmentNumber: number;
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
}
export interface DebtFundingInput {
  accountId: string;
  amount: string;
  fundingDate: string;
}
export interface CreateFinancialDebtRequest {
  type: DebtType;
  creditorName: string;
  description: string;
  notes?: string | null;
  originalPrincipal: string;
  startDate: string;
  installmentCount: number;
  installments: DebtInstallmentInput[];
  funding?: DebtFundingInput;
}
export type UpdateFinancialDebtRequest = Partial<CreateFinancialDebtRequest>;
export interface ListFinancialDebtsResponse {
  items: PublicFinancialDebt[];
  nextCursor: string | null;
}
export interface PayDebtInstallmentRequest {
  accountId: string;
  paymentDate: string;
}
export interface PayDebtInstallmentResponse {
  payment: PublicDebtPayment;
  installment: PublicDebtInstallment;
  debt: FinancialDebtDetail;
  projections: DebtProjections;
  created: boolean;
}
export type DebtDueFilter = 'overdue' | 'upcoming' | 'all';
export type DebtArchivedFilter = 'false' | 'true' | 'all';

export interface BudgetCategoryInput {
  categoryId: string;
  limitAmount: string;
}
export interface BudgetTotals {
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
  unbudgetedRealizedExpense: string;
  unbudgetedCommittedExpense: string;
  uncategorizedDebtCostRealized: string;
  uncategorizedDebtCostCommitted: string;
}
export interface PublicMonthlyBudgetCategory {
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
  limitAmount: string;
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
}
export interface PublicMonthlyBudget {
  id: string;
  month: string;
  totalLimit: string;
  notes: string | null;
  totals: BudgetTotals;
  categories: PublicMonthlyBudgetCategory[];
  createdAt: string;
  updatedAt: string;
}
export interface CreateMonthlyBudgetRequest {
  month: string;
  totalLimit: string;
  notes?: string | null;
  categories: BudgetCategoryInput[];
}
export interface UpdateMonthlyBudgetRequest {
  totalLimit?: string;
  notes?: string | null;
  categories?: BudgetCategoryInput[];
}
export interface CopyMonthlyBudgetRequest {
  targetMonth: string;
}
export type MonthlyBudgetErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'BUDGET_MONTH_CONFLICT'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'RELATED_RESOURCE_ARCHIVED'
  | 'INTERNAL_ERROR';

export interface DashboardCashPosition {
  totalRealizedBalance: string | null;
  availableAccountCount: number;
  unavailableAccountCount: number;
}
export interface DashboardMonthlyFlow {
  incomeRealized: string;
  incomePlanned: string;
  expenseRealized: string;
  expenseCommitted: string;
  realizedNet: string;
  plannedNet: string;
}
export interface DashboardBudgetSummary {
  id: string;
  totalLimit: string;
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
  exceeded: boolean;
}
export interface DashboardTransactionItem {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  plannedAmount: string;
  dueDate: string;
  categoryName: string | null;
  overdue: boolean;
}
export interface DashboardCardInvoiceItem {
  invoiceId: string;
  cardId: string;
  cardName: string;
  referenceMonth: string;
  status: 'OPEN' | 'CLOSED';
  total: string;
  dueDate: string;
  projectedOverdue: boolean;
}
export interface DashboardDebtInstallmentItem {
  debtId: string;
  installmentId: string;
  creditorName: string;
  installmentNumber: number;
  dueDate: string;
  totalAmount: string;
  projectedStatus: 'PENDING' | 'OVERDUE';
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
}
export interface DashboardCategoryExpense {
  categoryId: string;
  categoryName: string;
  amount: string;
}
export interface DashboardCounters {
  overdueTransactions: number;
  upcomingTransactions: number;
  unpaidCardInvoices: number;
  overdueDebtInstallments: number;
  pendingNotificationReviews: number;
}
export interface DashboardResponse {
  month: string;
  generatedAt: string;
  cashPosition: DashboardCashPosition;
  monthlyFlow: DashboardMonthlyFlow;
  budget: DashboardBudgetSummary | null;
  upcomingTransactions: DashboardTransactionItem[];
  cardInvoices: DashboardCardInvoiceItem[];
  debtInstallments: DashboardDebtInstallmentItem[];
  expenseByCategory: {
    categories: DashboardCategoryExpense[];
    uncategorizedDebtCostRealized: string;
  };
  counters: DashboardCounters;
}
