"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RepositoryCard } from "@/components/repositories/repository-card";
import { api } from "@/lib/api";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url?: string } | string;
  description: string | null;
  private: boolean;
  html_url: string;
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const { data } = await api.get<Repo[]>("/github/repos");
        setRepositories(data);
      } catch (err: any) {
        console.error("Failed to fetch repos:", err);
        setError("Could not load repositories. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  const handleConnect = () => {
    // Logic to connect a new repo or refresh
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
          <p className="text-muted-foreground">
            Select and manage your connected repositories
          </p>
        </div>

        <button
          onClick={handleConnect}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center p-8">
          <p className="text-muted-foreground">Loading repositories...</p>
        </div>
      )}

      {error && (
        <div className="p-4 border border-destructive/50 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              id={repo.id}
              name={repo.name}
              owner={
                typeof repo.owner === "string"
                  ? { login: repo.owner }
                  : { ...repo.owner, name: repo.owner.login }
              }
              visibility={repo.private ? "private" : "public"}
              description={repo.description || "No description"}
              lastUpdated="Recently"
            />
          ))}
          {repositories.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-10">
              No repositories found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}