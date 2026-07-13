interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between font-sans">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          {title}
        </h1>

        {description && (
          <p className="mt-1 text-sm text-ink-muted">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}