from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.purchase_indent import (
    PurchaseIndentCreate,
    PurchaseIndentStatusUpdate,
    PurchaseIndentResponse,
)
from app.models.purchase_indent import IndentStatus
from app.services.purchase_indent_service import PurchaseIndentService

router = APIRouter(prefix="/purchase-indents", tags=["Purchase Indents"])
service = PurchaseIndentService()


@router.post(
    "",
    response_model=PurchaseIndentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def create_indent(data: PurchaseIndentCreate, db: Session = Depends(get_db)):
    try:
        return service.create_indent(db, **data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "",
    response_model=list[PurchaseIndentResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def list_indents(indent_status: IndentStatus | None = None, db: Session = Depends(get_db)):
    return service.list_indents(db, status=indent_status)


@router.put(
    "/{uuid}/status",
    response_model=PurchaseIndentResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def update_indent_status(uuid: str, data: PurchaseIndentStatusUpdate, db: Session = Depends(get_db)):
    try:
        return service.update_indent_status(db, indent_uuid=uuid, **data.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)
def delete_indent(uuid: str, db: Session = Depends(get_db)):
    try:
        service.delete_indent(db, indent_uuid=uuid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
