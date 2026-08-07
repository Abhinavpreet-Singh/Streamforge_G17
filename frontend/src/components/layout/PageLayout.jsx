export default function PageLayout({ children, className = '' }) {
  return (
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-neutral-50 ${className}`}>
      {children}
    </div>
  );
}

export function PageBody({ children, className = '' }) {
  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-5 ${className}`}>
      {children}
    </div>
  );
}
