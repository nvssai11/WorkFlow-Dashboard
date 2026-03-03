"""
Azure connection and resource creation. One-time connect, then create resources from portal.
"""
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from backend.dependencies import get_current_user_token
from backend.services.github_service import GitHubService
from backend.services.azure_store import get as get_azure_creds, set_ as set_azure_creds, delete as delete_azure_creds
from backend.services import azure_service
from backend import db as app_db

router = APIRouter()


def _get_github_login(token: str) -> str:
    github = GitHubService()
    user = github.get_user(token)
    login = user.get("login") if isinstance(user, dict) else None
    if not login:
        raise HTTPException(status_code=401, detail="Could not get user from token")
    return login


class AzureConnectBody(BaseModel):
    credentials: str  # JSON string from az ad sp create-for-rbac --sdk-auth


class CreateResourcesBody(BaseModel):
    subscription_id: Optional[str] = None  # ignored: we always use subscriptionId from stored credentials
    region: str
    resource_group: str = "workflow-dashboard-rg"
    acr_name: str = "workflowdashboardacr"
    aks_name: str = "workflow-dashboard-aks"
    node_count: int = 1
    node_vm_size: str = "standard_dc2s_v3"
    enable_monitoring: bool = False
    repo_owner: Optional[str] = None  # for saving deployment per repo
    repo_name: Optional[str] = None


@router.get("/status")
def azure_status(token: str = Depends(get_current_user_token)):
    """Returns whether Azure is connected for the current user (one-time connect)."""
    login = _get_github_login(token)
    creds = get_azure_creds(login)
    return {"connected": bool(creds and creds.strip())}


@router.put("/connect")
def azure_connect(body: AzureConnectBody, token: str = Depends(get_current_user_token)):
    """Store Azure credentials (one-time). Paste JSON from az ad sp create-for-rbac --sdk-auth."""
    login = _get_github_login(token)
    try:
        # Validate JSON and required keys
        import json
        data = json.loads(body.credentials)
        if not all(k in data for k in ("clientId", "clientSecret", "tenantId", "subscriptionId")):
            raise ValueError("Missing clientId, clientSecret, tenantId, or subscriptionId")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    set_azure_creds(login, body.credentials)
    return {"status": "connected"}


@router.delete("/connect")
def azure_disconnect(token: str = Depends(get_current_user_token)):
    """Remove stored Azure credentials."""
    login = _get_github_login(token)
    delete_azure_creds(login)
    return {"status": "disconnected"}


@router.get("/subscriptions")
def list_subscriptions(token: str = Depends(get_current_user_token)):
    """List subscriptions available with the stored Azure credentials."""
    login = _get_github_login(token)
    creds = get_azure_creds(login)
    if not creds:
        raise HTTPException(status_code=400, detail="Connect Azure first in Settings")
    try:
        return {"subscriptions": azure_service.list_subscriptions(creds)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/regions")
def list_regions():
    """List supported Azure regions (for dropdowns)."""
    return {"regions": azure_service.get_regions()}


@router.get("/deployment")
def get_deployment(owner: str, repo: str, token: str = Depends(get_current_user_token)):
    """Return saved deployment (created resources) for this user and repo. Empty if never created."""
    login = _get_github_login(token)
    saved = app_db.get_deployment(login, owner, repo)
    if not saved:
        return {"deployment": None}
    return {"deployment": saved}


@router.get("/vm-sizes")
def list_vm_sizes(
    region: Optional[str] = None,
    token: str = Depends(get_current_user_token),
):
    """List VM sizes for AKS nodes. If region is provided and Azure is connected, returns sizes allowed for that subscription/region."""
    if region and region.strip():
        login = _get_github_login(token)
        creds = get_azure_creds(login)
        if creds:
            try:
                import json as _json
                data = _json.loads(creds)
                sub_id = data.get("subscriptionId")
                if sub_id:
                    sizes = azure_service.get_vm_sizes_for_region(creds, sub_id, region.strip())
                    return {"vm_sizes": sizes}
            except Exception:
                pass
    return {"vm_sizes": azure_service.get_vm_sizes()}


@router.post("/create-resources")
def create_resources(body: CreateResourcesBody, token: str = Depends(get_current_user_token)):
    """Create resource group, ACR, and AKS from the portal. Uses subscriptionId and tenantId from stored credentials."""
    login = _get_github_login(token)
    creds = get_azure_creds(login)
    if not creds:
        raise HTTPException(status_code=400, detail="Connect Azure first in Settings")
    import json as _json
    try:
        creds_data = _json.loads(creds)
        subscription_id = creds_data.get("subscriptionId") or body.subscription_id
        if not subscription_id:
            raise HTTPException(status_code=400, detail="Stored credentials missing subscriptionId. Re-paste the full JSON from az ad sp create-for-rbac --sdk-auth in Settings.")
    except _json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Stored Azure credentials are invalid JSON.")
    try:
        result = azure_service.create_resources(
            credentials_json=creds,
            subscription_id=subscription_id,
            region=body.region,
            resource_group=body.resource_group,
            acr_name=body.acr_name,
            aks_name=body.aks_name,
            node_count=body.node_count,
            node_vm_size=body.node_vm_size,
            enable_monitoring=body.enable_monitoring,
        )
    except Exception as e:
        err_msg = str(e)

        if "AlreadyInUse" in err_msg or "registry DNS name" in err_msg or "is already in use" in err_msg:
            m = re.search(r"The registry DNS name\s*([a-z0-9-]+\.azurecr\.io)", err_msg, re.IGNORECASE)
            suggestions = []
            if m:
                base = m.group(1).split(".")[0]
                suggestions = [f"{base}{i}" for i in range(1, 4)]
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "ACR registry name is already in use. Choose a different acr_name (or try one of the suggestions).",
                    "azure_error": err_msg,
                    "suggested_names": suggestions,
                },
            )

        if "not allowed in your subscription" in err_msg and "available VM sizes" in err_msg:
            m = re.search(r"The available VM sizes are\s*['\"]([^'\"]+)['\"]", err_msg)
            if m:
                raw = [s.strip() for s in m.group(1).split(",") if s.strip()]
                allowed = [s for s in raw if s in azure_service.SMALL_VM_SIZES] or raw[:10]
                if allowed:
                    return JSONResponse(
                        status_code=400,
                        content={"detail": err_msg, "allowed_sizes": allowed},
                    )

        if "InsufficientVCPUQuota" in err_msg or ("insufficient" in err_msg.lower() and "vcpu" in err_msg.lower() and "quota" in err_msg.lower()):
            other_regions = [r for r in ["eastus2", "westus2", "westus", "centralus"] if r != body.region]
            small_sizes = list(azure_service.SMALL_VM_SIZES)
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "Insufficient vCPU quota in this region. Try a different region (quota is per region) or request a quota increase: https://learn.microsoft.com/en-us/azure/quotas/view-quotas. " + err_msg,
                    "suggested_sizes": small_sizes,
                    "suggested_regions": other_regions[:3],
                },
            )

        if "MissingSubscriptionRegistration" in err_msg or ("not registered to use namespace" in err_msg.lower() and "microsoft." in err_msg.lower()):
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "Your subscription is not registered for a required Azure resource provider. Create resources without monitoring or register the provider: https://aka.ms/rps-not-found",
                },
            )

        if "PropertyChangeNotAllowed" in err_msg and "properties.vmSize" in err_msg:
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "AKS cluster already exists and node VM size cannot be changed in-place. Keep the existing size, create a new node pool, or create a new AKS cluster name.",
                },
            )

        raise HTTPException(status_code=500, detail=err_msg)

    if body.repo_owner and body.repo_name:
        app_db.set_deployment(
            github_login=login,
            repo_owner=body.repo_owner,
            repo_name=body.repo_name,
            resource_group=result.get("resource_group") or body.resource_group,
            region=result.get("region") or body.region,
            acr_name=body.acr_name,
            aks_name=result.get("aks_name") or body.aks_name,
            acr_login_server=result.get("acr_login_server", ""),
            acr_username=result.get("acr_username", ""),
            acr_password=result.get("acr_password", ""),
            subscription_id=result.get("subscription_id", subscription_id),
            extra=result,
        )

    return result
