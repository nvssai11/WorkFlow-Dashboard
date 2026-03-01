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
} from "lucide-react";
import Link from "next/link";
import { Cloud } from "lucide-react";

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
  has_backend?: boolean;
  has_frontend?: boolean;
  backend_layout?: string | null;
  frontend_layout?: string | null;
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

  // One-click automation: secrets form and setup
  const [secrets, setSecrets] = useState<Record<string, string>>({
    AZURE_CREDENTIALS: "",
    ACR_LOGIN_SERVER: "",
    ACR_USERNAME: "",
    ACR_PASSWORD: "",
    AKS_RESOURCE_GROUP: "",
    AKS_CLUSTER_NAME: "",
    BACKEND_PUBLIC_URL: "",
  });
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<string | null>(null);
  const [syncSecretsLoading, setSyncSecretsLoading] = useState(false);
  const [azureConnected, setAzureConnected] = useState<boolean | null>(null);
  const [subscriptions, setSubscriptions] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [vmSizes, setVmSizes] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({
    subscription_id: "",
    region: "eastus",
    resource_group: "workflow-dashboard-rg",
    acr_name: "workflowdashboardacr",
    aks_name: "workflow-dashboard-aks",
    node_count: 1,
    node_vm_size: "standard_dc2s_v3",
    enable_monitoring: false,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState<Record<string, string> | null>(null);
  const [showAdvancedSecrets, setShowAdvancedSecrets] = useState(false);
  const [useSimpleCd, setUseSimpleCd] = useState(false); // simple CD = single app, inline Dockerfile; off by default, enable on demand

  useEffect(() => {
    api.get<{ connected: boolean }>("/azure/status")
      .then(({ data }) => {
        setAzureConnected(data.connected);
        if (data.connected) {
          Promise.all([
            api.get<{ subscriptions: { id: string; name: string }[] }>("/azure/subscriptions"),
            api.get<{ regions: string[] }>("/azure/regions"),
            api.get<{ vm_sizes: string[] }>("/azure/vm-sizes", { params: { region: "eastus" } }),
          ]).then(([subs, regs, vms]) => {
            const subList = subs.data.subscriptions || [];
            const rList = regs.data.regions || [];
            const vList = vms.data.vm_sizes || [];
            setSubscriptions(subList);
            setRegions(rList);
            setVmSizes(vList);
            setCreateForm((f) => ({
              ...f,
              subscription_id: subList[0]?.id || f.subscription_id,
              region: rList.includes(f.region) ? f.region : rList[0] || f.region,
              node_vm_size: vList.includes(f.node_vm_size) ? f.node_vm_size : (vList[0] || "standard_dc2s_v3"),
            }));
          }).catch(() => {});
        }
      })
      .catch(() => setAzureConnected(false));
  }, []);

  /* Refetch VM sizes when region changes (so list matches subscription + region) */
  useEffect(() => {
    if (!azureConnected || !createForm.region) return;
    api.get<{ vm_sizes: string[] }>("/azure/vm-sizes", { params: { region: createForm.region } })
      .then(({ data }) => {
        const vList = data.vm_sizes || [];
        if (vList.length) {
          setVmSizes(vList);
          setCreateForm((f) => ({
            ...f,
            node_vm_size: vList.includes(f.node_vm_size) ? f.node_vm_size : (vList[0] || "standard_dc2s_v3"),
          }));
        }
      })
      .catch(() => {});
  }, [azureConnected, createForm.region]);

  /* ── Fetch repo details ── */
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const { data } = await api.get<Repository>(`/github/repos/${id}`);
        setRepo(data);

        const ownerLogin =
          typeof data.owner === "string" ? data.owner : data.owner.login;

        // Fetch languages, files, and saved deployment in parallel
        const [langResp, filesResp, deploymentResp] = await Promise.all([
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
          api
            .get<{ deployment: Record<string, string> | null }>("/azure/deployment", {
              params: { owner: ownerLogin, repo: data.name },
            })
            .catch(() => ({ data: { deployment: null } })),
        ]);

        setLanguages(langResp.data);
        setFiles(filesResp.data);

        const saved = deploymentResp.data?.deployment;
        if (saved) {
          setCreatedResult(saved);
          setSecrets((s) => ({
            ...s,
            ACR_LOGIN_SERVER: saved.acr_login_server || s.ACR_LOGIN_SERVER,
            ACR_USERNAME: saved.acr_username || s.ACR_USERNAME,
            ACR_PASSWORD: saved.acr_password || s.ACR_PASSWORD,
            AKS_RESOURCE_GROUP: saved.resource_group || s.AKS_RESOURCE_GROUP,
            AKS_CLUSTER_NAME: saved.aks_name || s.AKS_CLUSTER_NAME,
          }));
          setCreateForm((f) => ({
            ...f,
            region: saved.region || f.region,
            resource_group: saved.resource_group || f.resource_group,
            acr_name: saved.acr_name || f.acr_name,
            aks_name: saved.aks_name || f.aks_name,
          }));
        }
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

  /* ── Pipeline: Generate preview (template) ── */
  const handleGenerateTemplate = async () => {
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

  /* ── Pipeline: Generate with AI (repo + deployment config) ── */
  const deploymentConfig = {
    ACR_LOGIN_SERVER: secrets.ACR_LOGIN_SERVER?.trim() || createdResult?.acr_login_server,
    AKS_RESOURCE_GROUP: secrets.AKS_RESOURCE_GROUP?.trim() || createdResult?.resource_group,
    AKS_CLUSTER_NAME: secrets.AKS_CLUSTER_NAME?.trim() || createdResult?.aks_name,
  };
  const deploymentConfigured =
    !!(createdResult || (secrets.ACR_LOGIN_SERVER?.trim() && secrets.AKS_RESOURCE_GROUP?.trim() && secrets.AKS_CLUSTER_NAME?.trim()));

  const handleGenerateAI = async () => {
    if (!repo) return;
    setGenerating(true);
    setYamlPreview(null);
    try {
      const ownerLogin =
        typeof repo.owner === "string" ? repo.owner : repo.owner.login;
      const { data } = await api.post("/pipeline/generate-ai", {
        owner: ownerLogin,
        repo: repo.name,
        deployment_config: deploymentConfig,
      });
      setYamlPreview(data.yaml);
    } catch (err: any) {
      alert(err.response?.data?.detail || "AI generation failed.");
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

  /* ── One-click setup: sync secrets + generate Dockerfiles, k8s, workflow ── */
  const handleCreateResources = async () => {
    if (!createForm.region || !repo) return;
    setCreateLoading(true);
    setCreatedResult(null);
    const ownerLogin = typeof repo.owner === "string" ? repo.owner : repo.owner.login;
    try {
      const { data } = await api.post("/azure/create-resources", {
        ...createForm,
        repo_owner: ownerLogin,
        repo_name: repo.name,
      });
      setCreatedResult(data);
      setSecrets((s) => ({
        ...s,
        ACR_LOGIN_SERVER: data.acr_login_server || s.ACR_LOGIN_SERVER,
        ACR_USERNAME: data.acr_username || s.ACR_USERNAME,
        ACR_PASSWORD: data.acr_password || s.ACR_PASSWORD,
        AKS_RESOURCE_GROUP: data.resource_group || s.AKS_RESOURCE_GROUP,
        AKS_CLUSTER_NAME: data.aks_name || s.AKS_CLUSTER_NAME,
      }));
    } catch (err: any) {
      const res = err.response?.data;
      const allowed = res?.allowed_sizes;
      const suggested = res?.suggested_sizes;
      if (Array.isArray(allowed) && allowed.length) {
        setVmSizes(allowed);
        setCreateForm((f) => ({ ...f, node_vm_size: allowed[0] }));
        alert(
          "VM size not allowed in this subscription/region. Node size has been set to " +
            allowed[0] +
            ". Click Create resources again."
        );
      } else if (Array.isArray(suggested) && suggested.length) {
        const suggestedRegions = res?.suggested_regions;
        if (Array.isArray(suggestedRegions) && suggestedRegions.length) {
          setCreateForm((f) => ({
            ...f,
            region: suggestedRegions[0],
            node_vm_size: suggested[0],
          }));
          alert(
            "Insufficient vCPU quota in this region. Switched to region " +
              suggestedRegions[0] +
              " (quota is per region). Click Create resources again."
          );
        } else {
          setCreateForm((f) => ({ ...f, node_vm_size: suggested[0] }));
          alert(
            "Insufficient vCPU quota. Node size set to " +
              suggested[0] +
              ". Click Create resources again, or try a different region."
          );
        }
      } else {
        alert(res?.detail || "Create failed.");
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSetupFullCicd = async () => {
    if (!repo) return;
    const ownerLogin = typeof repo.owner === "string" ? repo.owner : repo.owner.login;
    const secretsPayload: Record<string, string> = {};
    for (const [k, v] of Object.entries(secrets)) {
      if (v && String(v).trim()) secretsPayload[k] = String(v).trim();
    }
    setSetupLoading(true);
    setSetupResult(null);
    try {
      const { data } = await api.post("/pipeline/setup-repo", {
        owner: ownerLogin,
        repo: repo.name,
        secrets: secretsPayload,
        steps: null,
        use_stored_azure: true,
        use_ai: !useSimpleCd,
        use_simple_cd: useSimpleCd,
      });
      setSetupResult(data.message || "Setup complete.");
    } catch (err: any) {
      setSetupResult(null);
      alert(err.response?.data?.detail || "Setup failed.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleSyncSecretsOnly = async () => {
    if (!repo) return;
    const ownerLogin = typeof repo.owner === "string" ? repo.owner : repo.owner.login;
    const secretsPayload: Record<string, string> = {};
    for (const [k, v] of Object.entries(secrets)) {
      if (v && String(v).trim()) secretsPayload[k] = String(v).trim();
    }
    if (Object.keys(secretsPayload).length === 0) {
      alert("Enter at least one secret to sync.");
      return;
    }
    setSyncSecretsLoading(true);
    setSetupResult(null);
    try {
      const { data } = await api.post("/pipeline/sync-secrets", {
        owner: ownerLogin,
        repo: repo.name,
        secrets: secretsPayload,
      });
      setSetupResult(data.message || "Secrets synced.");
    } catch (err: any) {
      setSetupResult(null);
      alert(err.response?.data?.detail || "Failed to sync secrets.");
    } finally {
      setSyncSecretsLoading(false);
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

        {/* ====== RIGHT: Workflow Automation (order: Deploy → CI → CD → Actions) ====== */}
        <div className="space-y-4">
          {/* ── 1) Deployment config (first) ── */}
          <section className="rounded-lg border bg-card p-5 space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Cloud size={14} /> Deployment config
            </h2>
            {azureConnected === false && (
              <p className="text-sm text-muted-foreground">
                <Link href="/settings" className="text-primary underline">Connect Azure in Settings</Link> once, then create resources and enable CI/CD from here.
              </p>
            )}
            {azureConnected === true && (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Create AKS + ACR (or use existing). Defaults can be changed.</p>
                  <p className="text-xs text-muted-foreground">Node sizes are limited to 2 or 4 vCPU. If quota is exceeded, try another region (e.g. eastus2).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">Subscription</span>
                      <select
                        value={createForm.subscription_id}
                        onChange={(e) => setCreateForm((f) => ({ ...f, subscription_id: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {subscriptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">Region</span>
                      <select
                        value={createForm.region}
                        onChange={(e) => setCreateForm((f) => ({ ...f, region: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {regions.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">Resource group</span>
                      <input
                        type="text"
                        value={createForm.resource_group}
                        onChange={(e) => setCreateForm((f) => ({ ...f, resource_group: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">ACR name</span>
                      <input
                        type="text"
                        value={createForm.acr_name}
                        onChange={(e) => setCreateForm((f) => ({ ...f, acr_name: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">AKS name</span>
                      <input
                        type="text"
                        value={createForm.aks_name}
                        onChange={(e) => setCreateForm((f) => ({ ...f, aks_name: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">Node size (2 or 4 vCPU only)</span>
                      <select
                        value={createForm.node_vm_size}
                        onChange={(e) => setCreateForm((f) => ({ ...f, node_vm_size: e.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {vmSizes.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-muted-foreground">Node count</span>
                      <input
                        type="number"
                        min={1}
                        value={createForm.node_count}
                        onChange={(e) => setCreateForm((f) => ({ ...f, node_count: parseInt(e.target.value, 10) || 1 }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm col-span-2">
                      <input
                        type="checkbox"
                        checked={createForm.enable_monitoring}
                        onChange={(e) => setCreateForm((f) => ({ ...f, enable_monitoring: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-muted-foreground">Enable monitoring (Log Analytics) — requires subscription to be registered for Microsoft.OperationsManagement</span>
                    </label>
                  </div>
                  <button
                    onClick={handleCreateResources}
                    disabled={createLoading}
                    className="flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {createLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    Create resources
                  </button>
                  {createdResult && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <Check size={14} /> Resources ready for this repo. Proceed to CI/CD below, or change settings and create again to update.
                      </p>
                      {(createdResult.aks_fqdn || createdResult.aks_api_ip) && (
                        <div className="text-xs rounded-md border bg-muted/40 p-3 space-y-1">
                          <p className="font-medium text-muted-foreground">AKS — access & test</p>
                          {createdResult.aks_api_ip && (
                            <p><span className="text-muted-foreground">Public IP (API):</span> <code className="bg-background px-1 rounded">{createdResult.aks_api_ip}</code></p>
                          )}
                          {createdResult.aks_fqdn && (
                            <p><span className="text-muted-foreground">Kubernetes API:</span> <code className="bg-background px-1 rounded break-all">https://{createdResult.aks_fqdn}</code></p>
                          )}
                          <p className="text-muted-foreground mt-1">Use: az aks get-credentials --resource-group {createdResult.resource_group} --name {createdResult.aks_name} — then kubectl. App URL (LoadBalancer) appears after first deploy.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSecrets(!showAdvancedSecrets)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showAdvancedSecrets ? "Hide" : "Show"} manual secrets / sync only
                  </button>
                  {showAdvancedSecrets && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <input type="text" placeholder="ACR_LOGIN_SERVER" value={secrets.ACR_LOGIN_SERVER} onChange={(e) => setSecrets((s) => ({ ...s, ACR_LOGIN_SERVER: e.target.value }))} className="rounded-md border border-input px-2 py-1.5 text-xs" />
                      <input type="text" placeholder="ACR_USERNAME" value={secrets.ACR_USERNAME} onChange={(e) => setSecrets((s) => ({ ...s, ACR_USERNAME: e.target.value }))} className="rounded-md border border-input px-2 py-1.5 text-xs" />
                      <input type="password" placeholder="ACR_PASSWORD" value={secrets.ACR_PASSWORD} onChange={(e) => setSecrets((s) => ({ ...s, ACR_PASSWORD: e.target.value }))} className="rounded-md border border-input px-2 py-1.5 text-xs" />
                      <input type="text" placeholder="AKS_RESOURCE_GROUP" value={secrets.AKS_RESOURCE_GROUP} onChange={(e) => setSecrets((s) => ({ ...s, AKS_RESOURCE_GROUP: e.target.value }))} className="rounded-md border border-input px-2 py-1.5 text-xs" />
                      <input type="text" placeholder="AKS_CLUSTER_NAME" value={secrets.AKS_CLUSTER_NAME} onChange={(e) => setSecrets((s) => ({ ...s, AKS_CLUSTER_NAME: e.target.value }))} className="rounded-md border border-input px-2 py-1.5 text-xs" />
                      <button type="button" onClick={handleSyncSecretsOnly} disabled={syncSecretsLoading} className="text-xs border rounded px-2 py-1.5 hover:bg-muted">Sync secrets only</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          {/* ── 2) CI Pipeline (after deployment configured) ── */}
          {deploymentConfigured && (
            <section className="rounded-lg border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Play size={14} /> CI Pipeline
              </h2>
              {!stack && (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Analyze the repo to detect tech stack and pipeline steps.</p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {analyzing ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <><Cpu size={14} /> Analyze repository</>}
                  </button>
                </div>
              )}
              {stack && (
                <div className="space-y-4">
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
                      <p className="text-muted-foreground mb-1">Backend / Frontend</p>
                      <p className="font-medium">{stack.has_backend ? "Backend" : ""}{stack.has_backend && stack.has_frontend ? " + " : ""}{stack.has_frontend ? "Frontend" : ""}</p>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">Pipeline steps</p>
                  <div className="space-y-2">
                    {suggestedSteps.map((step) => (
                      <label key={step} className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors text-sm">
                        <input type="checkbox" checked={enabledSteps[step] ?? false} onChange={() => setEnabledSteps((prev) => ({ ...prev, [step]: !prev[step] }))} className="rounded" />
                        <span className="shrink-0">{STEP_ICONS[step] || <Play size={16} />}</span>
                        <span>{STEP_LABELS[step] || step}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── 3) CD Pipeline (after deployment configured) ── */}
          {deploymentConfigured && (
            <section className="rounded-lg border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Container size={14} /> CD Pipeline
              </h2>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  On push to <code className="text-xs bg-muted px-1 rounded">main</code>, the workflow builds images, pushes to ACR, and deploys to AKS.
                </p>
                {(createdResult || deploymentConfig.ACR_LOGIN_SERVER) && (
                  <div className="text-xs text-muted-foreground space-y-1 rounded-md border p-3 bg-muted/30">
                    <p><strong>ACR:</strong> {createdResult?.acr_login_server || deploymentConfig.ACR_LOGIN_SERVER || "—"}</p>
                    <p><strong>AKS:</strong> {createdResult?.aks_name || deploymentConfig.AKS_CLUSTER_NAME || "—"} ({createdResult?.resource_group || deploymentConfig.AKS_RESOURCE_GROUP || "—"})</p>
                    {(createdResult?.aks_api_ip || createdResult?.aks_fqdn) && (
                      <p><strong>AKS API / Public IP:</strong> {createdResult.aks_api_ip || "—"} {createdResult.aks_fqdn && <span className="break-all">(https://{createdResult.aks_fqdn})</span>}</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── 4) Main action buttons (at end) ── */}
          {deploymentConfigured && (
            <section className="rounded-lg border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Automate CI/CD</h2>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSimpleCd}
                  onChange={(e) => setUseSimpleCd(e.target.checked)}
                  className="rounded"
                />
                <span>Simple CD (single app, default Node Dockerfile, minimal secrets)</span>
              </label>
              {commitResult && (
                <p className="text-sm text-green-600 flex items-center gap-1"><Check size={14} /> {commitResult}</p>
              )}
              {setupResult && (
                <p className="text-sm text-green-600 flex items-center gap-1"><Check size={14} /> {setupResult}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2.5 border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <FileCode size={16} />}
                  Generate CI/CD
                </button>
                <button
                  onClick={handleSetupFullCicd}
                  disabled={setupLoading || syncSecretsLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {setupLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Enable CI/CD
                </button>
                {repo?.html_url && (
                  <a
                    href={`${repo.html_url.replace(/\/$/, "")}/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-md text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Play size={16} /> View workflow runs
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {useSimpleCd
                  ? "Simple CD: one workflow file, 4 secrets (AZURE_CREDENTIALS, ACR_NAME, RESOURCE_GROUP, AKS_CLUSTER). Uncheck for full CI/CD with Dockerfiles and k8s."
                  : "Generate CI/CD: preview workflow then commit. Enable CI/CD: sync secrets, add Dockerfiles & k8s, and push workflow."}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* ── YAML Preview Modal ── */}
      {yamlPreview !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <FileCode size={18} /> Preview CI/CD Pipeline
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
