export interface Owner {
  login: string;
  avatar_url?: string | null;
  html_url?: string;
  name?: string | null;
  email?: string | null;
}

export interface Repository {
  id: number;
  name: string;
  owner: Owner;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
}
