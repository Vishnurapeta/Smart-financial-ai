export interface BackendHealthData {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
}

export interface BackendHealthResponse {
  success: boolean;
  data: BackendHealthData;
  error: null | {
    code: string;
    message: string;
  };
}

export interface MlHealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export * from './anomaly';
