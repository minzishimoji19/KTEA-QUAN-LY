export abstract class BaseService {
  protected logOperation(operation: string, details?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Service Operation] ${operation}`, details ? details : '');
    }
  }
}

export default BaseService;
