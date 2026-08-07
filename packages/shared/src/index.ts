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
