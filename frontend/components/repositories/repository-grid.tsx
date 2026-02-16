"use client";

import RepositoryCard from "./repository-card";
import { Repository } from "@/types/repository";

interface Props {
  repositories: Repository[];
  isLoading: boolean;
}

export default function RepositoryGrid({ repositories, isLoading }: Props) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading repositories...
      </p>
    );
  }

  if (repositories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No repositories found.
      </p>
    );
  }

  return (
    <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
      {repositories.map((repo) => (
        <RepositoryCard
          key={repo.id}
          id={repo.id}
          name={repo.name}
          owner={repo.owner}
          visibility={repo.private ? "private" : "public"}
          description={repo.description}
        />
      ))}
    </div>
  );
}
