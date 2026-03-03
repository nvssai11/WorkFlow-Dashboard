"""
Azure resource operations using stored service principal credentials.
Used to list subscriptions and create RG, ACR, AKS from the portal.
"""
import json
import logging
from typing import Any

from azure.identity import ClientSecretCredential
from azure.core.exceptions import ResourceNotFoundError
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.containerregistry import ContainerRegistryManagementClient
from azure.mgmt.containerservice import ContainerServiceClient
from azure.mgmt.containerservice.models import ManagedCluster, ManagedClusterAgentPoolProfile

logger = logging.getLogger(__name__)

# Common Azure regions and default VM sizes (prefer D-series for wider subscription support)
DEFAULT_REGIONS = [
    "eastus",
    "eastus2",
    "westus",
    "westus2",
    "westeurope",
    "northeurope",
    "southeastasia",
    "australiaeast",
]

# Only 2 and 4 vCPU sizes — never show 8/16 vCPU so quota stays within limits
SMALL_VM_SIZES = [
    "standard_dc2s_v3",      # 2 vCPU
    "standard_dc2ds_v3",     # 2 vCPU
    "standard_dc2as_v5",     # 2 vCPU
    "standard_dc2ads_v5",    # 2 vCPU
    "Standard_D2s_v3",       # 2 vCPU
    "Standard_D4s_v3",       # 4 vCPU
    "Standard_B2s",          # 2 vCPU
    "Standard_B4ms",         # 4 vCPU
]
DEFAULT_VM_SIZES = list(SMALL_VM_SIZES)


def _credential_from_json(credentials_json: str) -> tuple[ClientSecretCredential, str]:
    """Parse sdk-auth JSON and return (ClientSecretCredential, subscription_id)."""
    data = json.loads(credentials_json)
    client_id = data.get("clientId")
    client_secret = data.get("clientSecret")
    tenant_id = data.get("tenantId")
    subscription_id = data.get("subscriptionId")
    if not all([client_id, client_secret, tenant_id, subscription_id]):
        raise ValueError("Credentials must include clientId, clientSecret, tenantId, subscriptionId")
    cred = ClientSecretCredential(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
    )
    return cred, subscription_id


def list_subscriptions(credentials_json: str) -> list[dict[str, str]]:
    """Return list of {id, name} for subscriptions the SP can access. SDK-auth has one sub."""
    data = json.loads(credentials_json)
    sub_id = data.get("subscriptionId")
    if not sub_id:
        return []
    return [{"id": sub_id, "name": data.get("subscriptionName", "Azure subscription")}]


def create_resources(
    credentials_json: str,
    subscription_id: str,
    region: str,
    resource_group: str,
    acr_name: str,
    aks_name: str,
    log_analytics_name: str = "workflow-dashboard-logs",
    node_count: int = 1,
    node_vm_size: str = "standard_dc2s_v3",
    enable_monitoring: bool = False,
) -> dict[str, Any]:
    """
    Create resource group, Log Analytics (optional), ACR, and AKS.
    Monitoring is off by default so AKS works without registering Microsoft.OperationsManagement.
    Returns dict with resource names and ACR admin credentials for GitHub Secrets.
    """
    cred, sub_from_creds = _credential_from_json(credentials_json)
    # Always use subscription from the same credentials (clientId/tenantId/subscriptionId from pasted JSON)
    sub_id = subscription_id or sub_from_creds

    resource_client = ResourceManagementClient(cred, sub_id)
    acr_client = ContainerRegistryManagementClient(cred, sub_id)
    aks_client = ContainerServiceClient(cred, sub_id)

    # 1. Resource group
    resource_client.resource_groups.create_or_update(resource_group, {"location": region})

    log_analytics_id = None
    if enable_monitoring:
        try:
            from azure.mgmt.loganalytics import LogAnalyticsManagementClient
            log_client = LogAnalyticsManagementClient(cred, sub_id)
            workspace = log_client.workspaces.begin_create_or_update(
                resource_group,
                log_analytics_name,
                {"location": region, "sku": {"name": "PerGB2018"}, "retention_in_days": 30},
            ).result()
            log_analytics_id = workspace.id
        except Exception as e:
            err_str = str(e)
            if "MissingSubscriptionRegistration" in err_str or "OperationsManagement" in err_str or "OperationalInsights" in err_str:
                logger.warning("Monitoring skipped (subscription not registered for Log Analytics): %s", err_str)
            else:
                logger.warning("Log Analytics creation failed: %s", e)

    # 2. ACR
    try:
        acr_client.registries.get(resource_group, acr_name)
    except ResourceNotFoundError:
        acr_client.registries.begin_create(
            resource_group,
            acr_name,
            {"location": region, "sku": {"name": "Basic"}, "admin_user_enabled": True},
        ).result()

    # 3. AKS
    # If cluster already exists, reuse it. Updating the system pool vm_size on an existing
    # cluster fails with PropertyChangeNotAllowed, so only create on first run.
    try:
        aks_cluster = aks_client.managed_clusters.get(resource_group, aks_name)
    except ResourceNotFoundError:
        pool = ManagedClusterAgentPoolProfile(
            name="system",
            count=node_count,
            vm_size=node_vm_size,
            max_pods=30,
            mode="System",
        )
        cluster = ManagedCluster(
            location=region,
            agent_pool_profiles=[pool],
            dns_prefix=(aks_name[:8] + "dns").replace("-", ""),
            enable_rbac=False,
            identity={"type": "SystemAssigned"},
        )
        # Do not attach Log Analytics addon during create — it requires Microsoft.OperationsManagement
        # registration. Create AKS without monitoring so it always succeeds; user can enable in Portal later.
        aks_client.managed_clusters.begin_create_or_update(
            resource_group, aks_name, cluster
        ).result()
        aks_cluster = aks_client.managed_clusters.get(resource_group, aks_name)

    # 4. Cluster details (FQDN for API / kubectl; resolve to public IP for display)
    aks_fqdn = getattr(aks_cluster, "fqdn", None) or ""
    aks_api_ip = ""
    if aks_fqdn:
        try:
            import socket
            aks_api_ip = socket.gethostbyname(aks_fqdn)
        except Exception:
            pass

    # 5. ACR admin credentials
    creds = acr_client.registries.list_credentials(resource_group, acr_name)
    acr_login = f"{acr_name}.azurecr.io"

    return {
        "resource_group": resource_group,
        "region": region,
        "acr_login_server": acr_login,
        "acr_username": creds.username,
        "acr_password": creds.passwords[0].value if creds.passwords else "",
        "aks_name": aks_name,
        "subscription_id": sub_id,
        "aks_fqdn": aks_fqdn,
        "aks_api_ip": aks_api_ip,
    }


def get_regions() -> list[str]:
    return list(DEFAULT_REGIONS)


def get_vm_sizes_for_region(
    credentials_json: str,
    subscription_id: str,
    region: str,
) -> list[str]:
    """
    List VM sizes for AKS — only 2 and 4 vCPU sizes so we never request 16 vCPU.
    Returns intersection of Azure's regional list with SMALL_VM_SIZES.
    """
    try:
        cred, _ = _credential_from_json(credentials_json)
        from azure.mgmt.compute import ComputeManagementClient
        compute_client = ComputeManagementClient(cred, subscription_id)
        sizes = list(compute_client.virtual_machine_sizes.list(location=region))
        names = {s.name for s in sizes if getattr(s, "name", None)}
        # Only return small sizes (2/4 vCPU) that exist in this region
        return [n for n in SMALL_VM_SIZES if n in names] or list(DEFAULT_VM_SIZES)
    except Exception as e:
        logger.warning("Could not list VM sizes for %s: %s", region, e)
        return list(DEFAULT_VM_SIZES)


def get_vm_sizes() -> list[str]:
    """Static fallback list when region/subscription not available."""
    return list(DEFAULT_VM_SIZES)
