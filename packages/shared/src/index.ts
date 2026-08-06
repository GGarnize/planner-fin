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
