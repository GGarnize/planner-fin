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
  expiresIn: 900;
  user: PublicUser;
}
export interface ApiErrorResponse {
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
}

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

export type FinancialTransactionType = 'INCOME' | 'EXPENSE';
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
  installments: Array<PublicCardInstallment & { purchaseDescription: string }>;
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
  limitAmount: string;
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
}
export interface PublicMonthlyBudgetCategory extends BudgetTotals {
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
}
export interface PublicMonthlyBudget extends BudgetTotals {
  id: string;
  month: string;
  totalLimit: string;
  notes: string | null;
  categories: PublicMonthlyBudgetCategory[];
  unbudgetedRealizedExpense: string;
  unbudgetedCommittedExpense: string;
  uncategorizedDebtCostRealized: string;
  uncategorizedDebtCostCommitted: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateMonthlyBudgetRequest {
  month: string;
  totalLimit: string;
  notes: string | null;
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
