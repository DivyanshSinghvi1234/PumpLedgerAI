from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.enums import UserRole
from app.schemas.tally import (
    TallyExportRequest,
    TallyPreviewResponse,
    TallyMarkSyncedRequest,
    TallyImportResponse,
)
from app.services.tally_service import TallyService

router = APIRouter(
    prefix="/tally",
    tags=["Tally Sync"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.MANAGER))],
)

service = TallyService()


@router.post(
    "/preview",
    response_model=TallyPreviewResponse,
)
def preview_tally_export(
    request: TallyExportRequest,
    db: Session = Depends(get_db),
):
    try:
        return service.preview_export(db, request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate tally preview: {str(exc)}",
        )


@router.post(
    "/export",
)
def export_tally_xml(
    request: TallyExportRequest,
    db: Session = Depends(get_db),
):
    try:
        xml_content = service.generate_xml(db, request)
        
        # If requested, mark the exported vouchers and payments as synced
        if request.mark_as_synced:
            vouchers, payments = service.get_pending_items(
                db, request.from_date, request.to_date
            )
            voucher_uuids = [str(v.uuid) for v in vouchers]
            payment_uuids = [str(p.uuid) for p in payments if p.customer is not None]
            service.mark_as_synced(db, voucher_uuids, payment_uuids)

        filename = f"tally_import_{date.today().strftime('%Y%m%d')}.xml"
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate tally XML: {str(exc)}",
        )


@router.post(
    "/mark-synced",
    status_code=status.HTTP_204_NO_CONTENT,
)
def mark_items_synced(
    request: TallyMarkSyncedRequest,
    db: Session = Depends(get_db),
):
    try:
        service.mark_as_synced(
            db,
            request.voucher_uuids,
            request.payment_uuids,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark items as synced: {str(exc)}",
        )


@router.post(
    "/import",
    response_model=TallyImportResponse,
)
async def import_tally_xml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        content = await file.read()
        return service.import_xml_data(db, content)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(exc)}",
        )


@router.post(
    "/export-ledger-vouchers",
)
def export_tally_expenses_and_contra(
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
):
    """Export Expenses (Payment vouchers) and Bank Deposits (Contra vouchers) as Tally XML."""
    try:
        xml_content = service.generate_expenses_and_contra_xml(db, from_date, to_date)
        filename = f"tally_expenses_contra_{date.today().strftime('%Y%m%d')}.xml"
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate expenses/contra XML: {str(exc)}",
        )
