export interface AuthenticatedContext {
  userId: string;
  sessionId: string;
}
export const API_CONFIG = Symbol('API_CONFIG');
