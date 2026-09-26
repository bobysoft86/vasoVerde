export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
}
