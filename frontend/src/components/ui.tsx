import { Component, type ReactNode } from "react";
import { ArrowUpRight, Mountain, RefreshCw } from "lucide-react";

export function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="GeoSentinel home">
      <span className="brand-icon">
        <Mountain size={22} strokeWidth={1.5} />
      </span>
      <span>GeoSentinel</span>
    </button>
  );
}
export function Loading({
  label = "Preparing your geographic workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <div className="loader-orbit">
        <Mountain size={24} />
      </div>
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <p>Connection interrupted</p>
      <span>{message}</span>
      <button className="button secondary" onClick={retry}>
        <RefreshCw size={15} /> Try again
      </button>
    </div>
  );
}
export function SectionLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <ErrorState
        message="The interface could not render. Reload to reconnect to your local Python API."
        retry={() => window.location.reload()}
      />
    ) : (
      this.props.children
    );
  }
}
