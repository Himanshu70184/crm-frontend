export default function PageHeader({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 ${className}`}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {(action || children) && (
        <div className="flex items-center gap-3 flex-shrink-0">{action}{children}</div>
      )}
    </div>
  );
}
