export interface Repository {
  id: number;
  name: string;
  owner: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
}