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
