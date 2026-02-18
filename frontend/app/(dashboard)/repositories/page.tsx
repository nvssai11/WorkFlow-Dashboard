"use client";

import { useState } from "react";

const mockRepo = {
  id: 1,
  name: "DevOps-Automation",
  owner: {
    login: "team-alpha",
    avatar_url: "https://avatars.githubusercontent.com/u/9919?s=200&v=4",
  },
  description: "CI/CD pipeline automation workflows",
  private: false,
  language: "TypeScript",
  forks: 12,
  stars: 45,
  watchers: 18,
  openIssues: 4,
  updatedAt: "2 hours ago",
  defaultBranch: "main",
  files: [
    "README.md",
    "package.json",
    "Dockerfile",
    ".github/workflows/deploy.yml",
    "src/",
  ],
};

export default function RepositoryDetailsPage() {
  const [repo] = useState(mockRepo);

  return (
    <div className="space-y-10 bg-zinc-50 dark:bg-black min-h-screen p-6 rounded-xl">

      {/* ================= REPOSITORY OVERVIEW ================= */}
      <div className="bg-white dark:bg-zinc-900 border border-primary/40 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={repo.owner.avatar_url}
              alt={repo.owner.login}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h1 className="text-2xl font-semibold">{repo.name}</h1>
              <p className="text-muted-foreground text-sm">
                {repo.owner.login}
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs rounded-full font-medium ${
              repo.private
                ? "bg-red-100 text-red-600"
                : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {repo.private ? "Private" : "Public"}
          </span>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {repo.description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-6 text-sm">
          <Stat label="Language" value={repo.language} />
          <Stat label="Forks" value={repo.forks} />
          <Stat label="Stars" value={repo.stars} />
          <Stat label="Watchers" value={repo.watchers} />
          <Stat label="Open Issues" value={repo.openIssues} />
        </div>
      </div>

      {/* ================= CONFIGURE + ANALYSIS ================= */}
      <div className="grid lg:grid-cols-2 gap-8">

        {/* Configure Deployment */}
        <div className="bg-white dark:bg-zinc-900 border border-primary/40 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold">
            Configure Deployment
          </h2>

          <FormField label="Branch">
            <select className="w-full border rounded-lg p-2">
              <option>main</option>
              <option>develop</option>
            </select>
          </FormField>

          <FormField label="Trigger Type">
            <select className="w-full border rounded-lg p-2">
              <option>On Push</option>
              <option>On Pull Request</option>
              <option>Manual</option>
            </select>
          </FormField>

          <FormField label="Build Command">
            <input
              className="w-full border rounded-lg p-2"
              placeholder="npm run build"
            />
          </FormField>

          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm">
            Deploy Pipeline
          </button>
        </div>

        {/* Analysis */}
        <div className="bg-white dark:bg-zinc-900 border border-primary/40 rounded-2xl p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold">
            Repository Analysis
          </h2>

          <div className="space-y-4 text-sm">
            <AnalysisRow label="Last Updated" value={repo.updatedAt} />
            <AnalysisRow label="Default Branch" value={repo.defaultBranch} />
            <AnalysisRow label="CI Status" value="Passing" highlight />
          </div>
        </div>
      </div>

      {/* ================= FILES SECTION ================= */}
      <div className="bg-white dark:bg-zinc-900 border border-primary/40 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">
          Repository Files
        </h2>

        <ul className="space-y-2 text-sm text-muted-foreground">
          {repo.files.map((file) => (
            <li
              key={file}
              className="border rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {file}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Small Reusable UI Components ---------- */

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function AnalysisRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span
        className={
          highlight
            ? "text-emerald-600 font-medium"
            : "text-muted-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
