export type TableVM = {
  id: string;
  name: string;
  floor?: string;
  status: 'using' | 'empty';
  amount: number;
  startedAt?: string;
    isMine?: boolean;  
};