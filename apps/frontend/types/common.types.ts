export interface ApiResponse<T> {
  status: "SUCCESS" | "ERROR" | "VALIDATION_ERROR";
  message: string;
  data: T;
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElement: number;
  totalPages: number;
  last: boolean;
}
