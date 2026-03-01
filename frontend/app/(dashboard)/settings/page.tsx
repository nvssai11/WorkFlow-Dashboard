"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Check, Cloud } from "lucide-react";

export default function SettingsPage() {
  const [azureConnected, setAzureConnected] = useState<boolean | null>(null);
  const [azureJson, setAzureJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ connected: boolean }>("/azure/status").then(({ data }) => setAzureConnected(data.connected)).catch(() => setAzureConnected(false));
  }, []);

  const handleConnect = async () => {
    if (!azureJson.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.put("/azure/connect", { credentials: azureJson.trim() });
      setAzureConnected(true);
      setAzureJson("");
      setMessage("Azure connected. You can create resources and enable CI/CD from any repo.");
    } catch (e: any) {
      setMessage(e.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      await api.delete("/azure/connect");
      setAzureConnected(false);
      setMessage("Azure disconnected.");
    } catch {
      setMessage("Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">One-time setup. Configure once, use everywhere.</p>
      </div>

      <section className="rounded-xl border bg-card p-6 max-w-xl">
        <div className="flex items-center gap-2 mb-4">
          <Cloud size={20} className="text-muted-foreground" />
          <h2 className="font-medium">Azure</h2>
          {azureConnected === true && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check size={12} /> Connected
            </span>
          )}
        </div>
        {azureConnected === null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Checking…
          </div>
        )}
        {azureConnected === false && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Run this in your terminal (after <code className="text-xs bg-muted px-1 rounded">az login</code>). Replace <code className="text-xs bg-muted px-1 rounded">&lt;SUBSCRIPTION_ID&gt;</code> with your Azure subscription ID.
            </p>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
              {`az ad sp create-for-rbac --name github-actions-azure --role contributor --scopes /subscriptions/<SUBSCRIPTION_ID> --sdk-auth`}
            </pre>
            <p className="text-xs text-muted-foreground">
              Optional: replace <code className="bg-muted px-1 rounded">github-actions-azure</code> with a name you prefer; use your subscription ID (e.g. from <code className="bg-muted px-1 rounded">az account show --query id -o tsv</code>).
            </p>
            <p className="text-sm text-muted-foreground">
              Paste the JSON output below. We store it once and use it to create AKS/ACR from the app.
            </p>
            <textarea
              value={azureJson}
              onChange={(e) => setAzureJson(e.target.value)}
              placeholder='{"clientId":"...","clientSecret":"...","tenantId":"...","subscriptionId":"..."}'
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleConnect}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Connect Azure
            </button>
          </div>
        )}
        {azureConnected === true && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Azure is connected. You can create resources and enable CI/CD from the repo Deploy section.</p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm text-muted-foreground hover:text-foreground underline disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        )}
        {message && <p className="text-sm text-muted-foreground mt-3">{message}</p>}
      </section>
    </div>
  );
}
