export interface ApiErrorResponse {
  status: number;
  error: string;
  message: string;
  details: string[];
  timestamp: string;
}
