"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import RepositoryGrid from "@/components/repositories/repository-grid";
import { Repository } from "@/types/repository";

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setError("No access token found");
          setLoading(false);
          return;
        }

        const response = await fetch(
          "http://localhost:8000/github/repos",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch repositories");
        }

        const data = await response.json();

        const formatted: Repository[] = data.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          owner: {
            login: repo.owner?.login ?? repo.owner,
            avatar_url: repo.owner?.avatar_url ?? null,
          },
          description: repo.description ?? "No description provided",
          private: repo.private,
          html_url: repo.html_url,
          clone_url: repo.clone_url,
        }));

        setRepositories(formatted);
      } catch (err) {
        console.error(err);
        setError("Could not load repositories");
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  return (
    <div className="space-y-10 bg-zinc-50 dark:bg-black min-h-screen p-6 rounded-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Repositories
          </h1>
          <p className="text-muted-foreground">
            Select and manage your connected repositories
          </p>
        </div>

        {/* <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm">
          <Plus size={16} />
          Connect Repository
        </button> */}
      </div>

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      <RepositoryGrid repositories={repositories} isLoading={loading} />
    </div>
  );
}
