import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

import OCRReviewForm from "./components/OCRReviewForm";

export default function OCRReviewPage() {

  const location = useLocation();
  const navigate = useNavigate();
  const batch = Array.isArray(location.state?.batch) ? location.state.batch : [location.state];
  const [reviewIndex, setReviewIndex] = useState(0);

  function showNextReview() {
    if (reviewIndex + 1 < batch.length) {
      setReviewIndex((index) => index + 1);
      return;
    }
    navigate("/dashboard/vouchers");
  }

  return (
    <div className="space-y-8">

      <h1 className="text-3xl font-bold">
        OCR Review
      </h1>

      <OCRReviewForm
        key={reviewIndex}
        data={batch[reviewIndex]}
        onSaved={showNextReview}
      />

    </div>
  );
}
