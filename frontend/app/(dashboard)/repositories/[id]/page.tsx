import { notFound } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

// Mock data
const repositories = [
  {
    id: 1,
    name: "jigsaw-puzzle-phoenix",
    owner: "aadya28",
    visibility: "public",
    description: "A multiplayer Jigsaw Puzzle Game",
    lastUpdated: "2m ago",
    cloneUrl: "https://github.com/aadya28/jigsaw-puzzle-phoenix.git",
  },
  {
    id: 2,
    name: "BizzAI",
    owner: "nvssai11",
    visibility: "private",
    description: "Open-source POS system",
    lastUpdated: "10m ago",
    cloneUrl: "https://github.com/nvssai11/BizzAI.git",
  },
];

export default async function RepositoryDetailsPage(
  props: PageProps
) {
  const { id } = await props.params;

  const numericId = parseInt(id, 10);

  const repo = repositories.find((r) => r.id === numericId);

  if (!repo) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{repo.name}</h1>
        <p className="text-muted-foreground">Owned by {repo.owner}</p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Description</h3>
          <p className="text-sm text-muted-foreground">
            {repo.description}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium">Visibility</h3>
          <p className="text-sm text-muted-foreground capitalize">
            {repo.visibility}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium">Clone URL</h3>
          <p className="text-sm text-muted-foreground break-all">
            {repo.cloneUrl}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium">Last Updated</h3>
          <p className="text-sm text-muted-foreground">
            {repo.lastUpdated}
          </p>
        </div>
      </div>
    </div>
  );
}
