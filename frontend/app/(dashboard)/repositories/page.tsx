// import { Plus } from "lucide-react";
// import { RepositoryCard } from "@/components/repositories/repository-card";

// // Mock repositories data
// const repositories = [
//   {
//     id: 1,
//     name: "jigsaw-puzzle-phoenix",
//     owner: "aadya28",
//     visibility: "public" as const,
//     description: "A multiplayer Jigsaw Puzzle Game",
//     lastUpdated: "2m ago",
//   },
//   {
//     id: 2,
//     name: "BizzAI",
//     owner: "nvssai11",
//     visibility: "private" as const,
//     description: "Open-source POS and inventory management system",
//     lastUpdated: "10m ago",
//   },
//   {
//     id: 3,
//     name: "DevOps-Automation",
//     owner: "team-alpha",
//     visibility: "public" as const,
//     description: "CI/CD pipeline automation workflows",
//     lastUpdated: "1h ago",
//   },
//   {
//     id: 4,
//     name: "AI-Analytics",
//     owner: "data-team",
//     visibility: "private" as const,
//     description: "Machine learning analytics platform",
//     lastUpdated: "3h ago",
//   },
// ];

// export default function RepositoriesPage() {
//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-semibold tracking-tight">
//             Repositories
//           </h1>
//           <p className="text-muted-foreground">
//             Select and manage your connected repositories
//           </p>
//         </div>

//         <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium">
//           <Plus size={16} />
//           Connect Repository
//         </button>
//       </div>

//       {/* Grid */}
//       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
//         {repositories.map((repo) => (
//   <RepositoryCard
//     key={repo.id}
//     id={repo.id}
//     name={repo.name}
//     owner={repo.owner}
//     visibility={repo.visibility}
//     description={repo.description}
//     lastUpdated={repo.lastUpdated}
//   />
// ))}

//       </div>
//     </div>
//   );
// }

"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RepositoryCard } from "@/components/repositories/repository-card";

interface BackendRepo {
  id: number;
  name: string;
  owner: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<BackendRepo[]>([]);
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
        setRepositories(data);
      } catch (err: any) {
        console.error(err);
        setError("Could not load repositories");
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Repositories
          </h1>
          <p className="text-muted-foreground">
            Select and manage your connected repositories
          </p>
        </div>

        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium">
          <Plus size={16} />
          Connect Repository
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <p className="text-muted-foreground">
          Loading repositories...
        </p>
      )}

      {/* Error State */}
      {error && (
        <p className="text-red-500 text-sm">
          {error}
        </p>
      )}

      {/* Data Grid */}
      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              id={repo.id}
              name={repo.name}
              owner={typeof repo.owner === "object" && repo.owner !== null ? repo.owner : { login: repo.owner }}
              visibility={repo.private ? "private" : "public"}
              description={repo.description}
              lastUpdated="Recently"
            />
          ))}
        </div>
      )}
    </div>
  );
}