export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: 'admin' | 'operator';
      };
    }
  }
}
