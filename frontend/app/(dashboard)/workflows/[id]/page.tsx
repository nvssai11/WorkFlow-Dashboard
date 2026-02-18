"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  FileCode,
  Folder,
  Globe,
  Lock,
  Loader2,
  Cpu,
  Play,
  X,
  Check,
  FileText,
  Box,
  Container,
  Download,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";

/* ───── Types ───── */

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url?: string };
  html_url: string;
  description: string | null;
  language: string | null;
  private: boolean;
  clone_url: string;
}

interface FileItem {
  name: string;
  type: "file" | "dir";
  path: string;
  size: number;
}

interface StackInfo {
  language: string;
  framework: string;
  has_dockerfile: boolean;
  dependency_file: string | null;
  detected_files: string[];
  has_test_script: boolean;
}

/* ───── Language color map ───── */

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  PHP: "#4F5D95",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Dart: "#00B4AB",
};

/* ───── Step helpers ───── */

const STEP_LABELS: Record<string, string> = {
  checkout: "Checkout Code",
  install_deps: "Install Dependencies",
  run_tests: "Run Tests",
  docker_build: "Build Docker Image",
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  checkout: <Download size={16} className="text-blue-400" />,
  install_deps: <Box size={16} className="text-yellow-400" />,
  run_tests: <CheckCircle2 size={16} className="text-green-400" />,
  docker_build: <Container size={16} className="text-cyan-400" />,
};

/* ═══════════════════════════════════════════ */
/*                Main Page                    */
/* ═══════════════════════════════════════════ */

export default function RepositoryDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  // Repo data
  const [repo, setRepo] = useState<Repository | null>(null);
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pipeline state
  const [stack, setStack] = useState<StackInfo | null>(null);
  const [suggestedSteps, setSuggestedSteps] = useState<string[]>([]);
  const [enabledSteps, setEnabledSteps] = useState<Record<string, boolean>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [yamlPreview, setYamlPreview] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  /* ── Fetch repo details ── */
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const { data } = await api.get<Repository>(`/github/repos/${id}`);
        setRepo(data);

        const ownerLogin =
          typeof data.owner === "string" ? data.owner : data.owner.login;

        // Fetch languages and files in parallel
        const [langResp, filesResp] = await Promise.all([
          api
            .get("/github/repo-languages", {
              params: { owner: ownerLogin, repo: data.name },
            })
            .catch(() => ({ data: {} })),
          api
            .get<FileItem[]>("/github/repo-contents", {
              params: { owner: ownerLogin, repo: data.name, path: "" },
            })
            .catch(() => ({ data: [] })),
        ]);

        setLanguages(langResp.data);
        setFiles(filesResp.data);
      } catch {
        setError("Could not load repository details.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  /* ── Pipeline: Analyze ── */
  const handleAnalyze = async () => {
    if (!repo) return;
    setAnalyzing(true);
    setCommitResult(null);
    try {
      const ownerLogin =
        typeof repo.owner === "string" ? repo.owner : repo.owner.login;
      const { data } = await api.post("/pipeline/suggest", {
        owner: ownerLogin,
        repo: repo.name,
      });
      setStack(data.stack);
      setSuggestedSteps(data.suggested_steps);
      const initial: Record<string, boolean> = {};
      data.suggested_steps.forEach((s: string) => (initial[s] = true));
      setEnabledSteps(initial);
    } catch {
      alert("Failed to analyze repository.");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ── Pipeline: Generate preview ── */
  const handleGenerate = async () => {
    if (!repo) return;
    setGenerating(true);
    try {
      const ownerLogin =
        typeof repo.owner === "string" ? repo.owner : repo.owner.login;
      const activeSteps = suggestedSteps.filter((s) => enabledSteps[s]);
      const { data } = await api.post("/pipeline/ci/preview", {
        owner: ownerLogin,
        repo: repo.name,
        steps: activeSteps,
      });
      setYamlPreview(data.yaml);
    } catch {
      alert("Failed to generate pipeline.");
    } finally {
      setGenerating(false);
    }
  };

  /* ── Pipeline: Commit ── */
  const handleCommit = async () => {
    if (!repo || !yamlPreview) return;
    setCommitting(true);
    try {
      const ownerLogin =
        typeof repo.owner === "string" ? repo.owner : repo.owner.login;
      const { data } = await api.post("/pipeline/commit", {
        owner: ownerLogin,
        repo: repo.name,
        type: "ci",
        yaml: yamlPreview,
      });
      setCommitResult(data.message);
      setYamlPreview(null);
    } catch {
      alert("Failed to commit pipeline.");
    } finally {
      setCommitting(false);
    }
  };

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive text-sm">{error || "Repository not found"}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  const ownerLogin =
    typeof repo.owner === "string" ? repo.owner : repo.owner.login;

  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/workflows"
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2 flex-wrap">
            {repo.name}
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${repo.private
                ? "bg-red-100 text-red-600 border-red-200"
                : "bg-green-100 text-green-600 border-green-200"
                }`}
            >
              {repo.private ? (
                <span className="flex items-center gap-1"><Lock size={10} /> Private</span>
              ) : (
                <span className="flex items-center gap-1"><Globe size={10} /> Public</span>
              )}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">{ownerLogin}</p>
        </div>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors whitespace-nowrap"
        >
          View on GitHub
        </a>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* ====== LEFT: Repository Details ====== */}
        <div className="space-y-4">
          {/* Description */}
          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              About
            </h2>
            <p className="text-sm leading-relaxed">
              {repo.description || "No description provided."}
            </p>

            {/* Clone URL */}
            <div className="pt-2">
              <code className="block bg-muted px-3 py-2 rounded text-xs break-all">
                {repo.clone_url}
              </code>
            </div>
          </section>

          {/* Languages */}
          {totalBytes > 0 && (
            <section className="rounded-lg border bg-card p-5 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Languages
              </h2>

              {/* Bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {Object.entries(languages).map(([lang, bytes]) => (
                  <div
                    key={lang}
                    style={{
                      width: `${(bytes / totalBytes) * 100}%`,
                      backgroundColor: LANG_COLORS[lang] || "#8b8b8b",
                    }}
                    title={`${lang} ${((bytes / totalBytes) * 100).toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {Object.entries(languages).map(([lang, bytes]) => (
                  <span key={lang} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: LANG_COLORS[lang] || "#8b8b8b" }}
                    />
                    {lang}{" "}
                    <span className="text-muted-foreground">
                      {((bytes / totalBytes) * 100).toFixed(1)}%
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Files */}
          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Files
            </h2>
            {files.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files found.</p>
            ) : (
              <ul className="divide-y text-sm max-h-72 overflow-y-auto">
                {/* Sort: dirs first, then files alphabetically */}
                {[...files]
                  .sort((a, b) => {
                    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((f) => (
                    <li
                      key={f.path}
                      className="flex items-center gap-2 py-1.5 px-1"
                    >
                      {f.type === "dir" ? (
                        <Folder size={14} className="text-blue-400 shrink-0" />
                      ) : (
                        <FileText size={14} className="text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        {/* ====== RIGHT: Workflow Automation ====== */}
        <div className="space-y-4">
          {/* ── CI Pipeline ── */}
          <section className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Play size={14} /> CI Pipeline
              </h2>
              {commitResult && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check size={12} /> {commitResult}
                </span>
              )}
            </div>

            {/* Not analyzed yet */}
            {!stack && (
              <div className="text-center py-6 space-y-3">
                <Cpu size={28} className="mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Analyze your repository to detect its tech stack and generate a CI pipeline.
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Cpu size={14} /> Analyze Repository
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Stack analyzed */}
            {stack && (
              <div className="space-y-4">
                {/* Stack info */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-muted-foreground mb-1">Language</p>
                    <p className="font-medium capitalize">{stack.language}</p>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-muted-foreground mb-1">Framework</p>
                    <p className="font-medium capitalize">{stack.framework}</p>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <p className="text-muted-foreground mb-1">Docker</p>
                    <p className="font-medium">
                      {stack.has_dockerfile ? "Detected" : "None"}
                    </p>
                  </div>
                </div>

                {/* Steps toggles */}
                <div>
                  <p className="text-xs font-medium mb-2 text-muted-foreground">
                    Pipeline Steps
                  </p>
                  <div className="space-y-2">
                    {suggestedSteps.map((step) => (
                      <label
                        key={step}
                        className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={enabledSteps[step] ?? false}
                          onChange={() =>
                            setEnabledSteps((prev) => ({
                              ...prev,
                              [step]: !prev[step],
                            }))
                          }
                          className="rounded"
                        />
                        <span className="shrink-0">
                          {STEP_ICONS[step] || <Play size={16} />}
                        </span>
                        <span>{STEP_LABELS[step] || step}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={
                    generating ||
                    !suggestedSteps.some((s) => enabledSteps[s])
                  }
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <FileCode size={14} /> Generate CI Pipeline
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* ── CD Pipeline (placeholder) ── */}
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-3">
              <Container size={14} /> CD Pipeline
            </h2>
            <div className="text-center py-8 space-y-2">
              <Clock size={28} className="mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Coming Soon</p>
              <p className="text-xs text-muted-foreground/60">
                Continuous Deployment pipeline automation will be available in a future update.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* ── YAML Preview Modal ── */}
      {yamlPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <FileCode size={18} /> Preview CI Pipeline
              </h3>
              <button
                onClick={() => setYamlPreview(null)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-5">
              <textarea
                value={yamlPreview}
                onChange={(e) => setYamlPreview(e.target.value)}
                className="w-full h-full min-h-[300px] font-mono text-xs bg-muted/50 border rounded-md p-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                spellCheck={false}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
              <button
                onClick={() => setYamlPreview(null)}
                className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {committing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Committing...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Confirm & Commit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
