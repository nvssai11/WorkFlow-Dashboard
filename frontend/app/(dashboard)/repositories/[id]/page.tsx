"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  html_url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  clone_url: string;
  created_at?: string;
  updated_at?: string;
}

export default function RepositoryDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepo = async () => {
      try {
        if (!id) return;
        const { data } = await api.get<Repository>(`/github/repos/${id}`);
        setRepo(data);
      } catch (err: any) {
        console.error("Failed to fetch repo:", err);
        setError("Could not load repository details.");
      } finally {
        setLoading(false);
      }
    };

    fetchRepo();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Loading repository details...</p>
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="p-4 border border-destructive/50 rounded-md bg-destructive/10 text-destructive text-sm">
          {error || "Repository not found"}
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/repositories"
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {repo.name}
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${repo.private
                  ? "bg-red-100 text-red-600 border-red-200"
                  : "bg-green-100 text-green-600 border-green-200"
                }`}
            >
              {repo.private ? "Private" : "Public"}
            </span>
          </h1>
          <p className="text-muted-foreground">Owned by {repo.owner.login}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 space-y-4 h-fit">
          <h2 className="text-lg font-medium mb-4">Details</h2>

          <div>
            <h3 className="text-sm font-medium">Description</h3>
            <p className="text-sm text-muted-foreground">
              {repo.description || "No description provided."}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium">Language</h3>
            <p className="text-sm text-muted-foreground">
              {repo.language || "Not specified"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium">Clone URL</h3>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-muted px-2 py-1 rounded text-xs break-all flex-1">
                {repo.clone_url}
              </code>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-medium mb-4">Actions</h2>
          <div className="space-y-2">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors text-sm font-medium"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
