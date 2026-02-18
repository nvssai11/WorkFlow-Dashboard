"use client";

import RepositoryCard from "./repository-card";

interface Owner {
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  html_url?: string;
}

interface Repository {
  id: number;
  name: string;
  owner: Owner;
  visibility: "public" | "private";
  description: string;
  lastUpdated: string;
}

interface Props {
  repositories: Repository[];
  isLoading: boolean;
}

export default function RepositoryGrid({ repositories, isLoading }: Props) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (repositories.length === 0) {
    return <p className="text-sm text-muted-foreground">No repositories found.</p>;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {repositories.map((repo) => (
        <RepositoryCard
          key={repo.id}
          id={repo.id}
          name={repo.name}
          owner={repo.owner && typeof repo.owner === "object" ? repo.owner : { login: "Unknown", html_url: "", avatar_url: null, name: null, email: null }}
          visibility={repo.visibility}
          description={repo.description}
          lastUpdated={repo.lastUpdated}
        />
      ))}
    </div>
  );
}