"""Typed router; invalid inputs return redacted errors, never precise geometry."""
import asyncio
from functools import lru_cache

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from security import client_ip

from .climate import ClimateService
from .geometry import area_details
from .place import PlaceService
from .providers.base import ProviderError
from .schemas import FieldRequest, LocationRequest, Polygon, PreviewRequest
from .service import RemoteSensingService

router = APIRouter(prefix="/remote-sensing", tags=["Field Intelligence"])


@lru_cache(maxsize=1)
def get_service():
    return RemoteSensingService()


@lru_cache(maxsize=1)
def get_climate_service():
    return ClimateService()


@lru_cache(maxsize=1)
def get_place_service():
    return PlaceService()


async def parse(request, schema):
    async def bounded_body():
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 32768:
                raise ValueError()
            chunks.append(chunk)
        return b"".join(chunks)
    try:
        return schema.model_validate_json(await asyncio.wait_for(bounded_body(), timeout=10))
    except (ValidationError, ValueError, TimeoutError):
        raise ProviderError("invalid_request", "Invalid field request: check polygon, dates, layer and output limits", 422) from None


def failure(exc):
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else {}
    return JSONResponse({"success": False, "code": exc.code, "error": exc.message}, status_code=exc.status, headers=headers)


@router.get("/status")
def status():
    return {"success": True, "data": get_service().status()}


def request_documentation(schema):
    document = schema.model_json_schema()
    definitions = document.pop("$defs", {})
    def inline(value):
        if isinstance(value, list):
            return [inline(item) for item in value]
        if isinstance(value, dict):
            if "$ref" in value:
                return inline(definitions[value["$ref"].rsplit("/", 1)[-1]])
            return {key: inline(item) for key, item in value.items()}
        return value
    return {"requestBody": {"required": True, "content": {"application/json": {"schema": inline(document)}}}}


@router.post("/geometry", openapi_extra=request_documentation(Polygon))
async def geometry(request: Request):
    try:
        polygon = await parse(request, Polygon)
        return {"success": True, "data": {"geometry": polygon.model_dump(),
            "area": area_details(polygon.model_dump(), get_service().settings.max_area_ha)}}
    except ProviderError as exc:
        return failure(exc)
    except ValueError:
        return failure(ProviderError("invalid_geometry", "Field area or geometry exceeds supported limits", 422))


@router.post('/climate', openapi_extra=request_documentation(LocationRequest))
async def climate(request: Request):
    from starlette.concurrency import run_in_threadpool
    try:
        point = await parse(request, LocationRequest)
        result = await run_in_threadpool(get_climate_service().get, point, client_ip(request))
        return {'success':True,'data':result}
    except ProviderError as exc:
        return failure(exc)


@router.post('/place', openapi_extra=request_documentation(LocationRequest))
async def place(request: Request):
    from starlette.concurrency import run_in_threadpool
    try:
        point=await parse(request,LocationRequest)
        data=await run_in_threadpool(get_place_service().get,point,client_ip(request))
        return {'success':True,'data':data}
    except ProviderError as exc:
        return failure(exc)


def account_identity(request):
    factory = getattr(request.app.state, "v2_database", None)
    if factory is None:
        raise ProviderError("account_required", "Sign in to your Krishyak account for satellite analysis", 401)
    from fastapi import HTTPException

    from v2.auth import authenticate

    with factory() as db:
        try:
            farmer, _ = authenticate(db, request)
        except HTTPException as error:
            raise ProviderError("account_required", "Sign in to your Krishyak account for satellite analysis",
                                error.status_code) from None
    return f"owner:{farmer.id}"


async def execute(request, operation, schema=FieldRequest):
    # Network work runs in FastAPI's thread pool, never blocks the event loop.
    from starlette.concurrency import run_in_threadpool
    try:
        ip = client_ip(request)
        settings = getattr(request.app.state, "v2_settings", None)
        if settings is not None and settings.deployed:
            # Satellite requests spend a metered credential. In deployments
            # they need a signed-in account and are budgeted per account.
            ip = await run_in_threadpool(account_identity, request)
        payload = await parse(request, schema)
        result, hit = await run_in_threadpool(get_service().execute, operation, payload, ip)
        if operation == "preview":
            return Response(result, media_type="image/png", headers={"Cache-Control": "private, no-store",
                "X-Remote-Sensing-Cache": "hit" if hit else "miss"})
        return {"success": True, "data": result}
    except ProviderError as exc:
        return failure(exc)
    except ValueError:
        return failure(ProviderError("invalid_geometry", "Field area or raster extent exceeds supported limits", 422))


@router.post("/acquisitions", openapi_extra=request_documentation(FieldRequest))
async def acquisitions(request: Request):
    return await execute(request, "acquisitions")


@router.post("/timeseries", openapi_extra=request_documentation(FieldRequest))
async def timeseries(request: Request):
    return await execute(request, "timeseries")


@router.post("/preview", openapi_extra=request_documentation(PreviewRequest))
async def preview(request: Request):
    return await execute(request, "preview", PreviewRequest)
