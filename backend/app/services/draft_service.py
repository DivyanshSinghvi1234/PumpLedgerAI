from app.schemas.voucher_draft import VoucherDraft


class DraftService:

    @staticmethod
    def create(
        upload,
        ocr,
    ) -> VoucherDraft:

        return VoucherDraft(
            upload=upload,
            extracted_data=ocr,
            ready_to_save=False,
        )