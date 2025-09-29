export type LoginBody = {
  email: string;
  password: string;
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};
export type User = {
  id?: string;
  email?: string;
  name?: string;
  role?: 'WAITER' | 'CASHIER' | 'ADMIN' | string;
};
export type LoginResponse = {
  response?: {
    success: boolean;
    code: number;
    message: string;
    data: Tokens;
  };
  // một số backend còn lặp lại data ở root
  data?: Tokens;
  success?: boolean;
};
