export interface Trip {
  id: string;
  name: string;
  members: string[];
  createdAt?: any;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: 'JPY' | 'TWD';
  category: string;
  paymentMethod: string;
  cardName: string | null;
  date: string;
  userId: string;
  userEmail: string;
  createdAt?: any;
}

export interface Category {
  name: string;
  emoji: string;
  color: string;
}

export interface AllowedUser {
  email: string;
}
