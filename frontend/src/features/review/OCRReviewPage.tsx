import { useLocation } from "react-router-dom";

import OCRReviewForm from "./components/OCRReviewForm";

export default function OCRReviewPage() {

  const location = useLocation();

  return (
    <div className="space-y-8">

      <h1 className="text-3xl font-bold">
        OCR Review
      </h1>

      <OCRReviewForm
        data={location.state}
      />

    </div>
  );
}