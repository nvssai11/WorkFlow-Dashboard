"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
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

export default function WorkflowsPage() {
  const [repositories, setRepositories] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repositories;
    const q = searchQuery.trim().toLowerCase();
    return repositories.filter((repo) => {
      const ownerLogin =
        typeof repo.owner === "string" ? repo.owner : repo.owner?.login ?? "";
      return (
        repo.name.toLowerCase().includes(q) ||
        repo.full_name.toLowerCase().includes(q) ||
        (repo.description ?? "").toLowerCase().includes(q) ||
        ownerLogin.toLowerCase().includes(q)
      );
    });
  }, [repositories, searchQuery]);

  const handleConnect = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Select a repository to manage its workflows
          </p>
        </div>

        <button
          onClick={handleConnect}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium shrink-0"
        >
          <Plus size={16} />
          Refresh
        </button>
      </div>

      {!loading && !error && repositories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search repositories by name, owner, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Search repositories"
          />
        </div>
      )}

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
          {filteredRepos.map((repo) => (
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
          {filteredRepos.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-10">
              {repositories.length === 0
                ? "No repositories found."
                : "No repositories match your search."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}