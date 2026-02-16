import { notFound } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

export default function RepositoryDetailsPage({ params }: PageProps) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Repository Details
      </h1>

      <p className="text-muted-foreground">
        Repository ID: {id}
      </p>

      {/* Later you can fetch repo details here */}
    </div>
  );
}
